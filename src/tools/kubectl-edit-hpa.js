/**
 * Edit Kubernetes HorizontalPodAutoscaler (HPA) replica count range
 * Only allow modification of minReplicas and maxReplicas for security
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class KubectlEditHpaTool extends BaseTool {
  constructor() {
    super('kubectl_edit_hpa', 'Edit HorizontalPodAutoscaler replica count range');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          hpaName: {
            type: 'string',
            description: 'HorizontalPodAutoscaler name'
          },
          minReplicas: {
            type: 'integer',
            description: 'Minimum replica count (1-100)'
          },
          maxReplicas: {
            type: 'integer',
            description: 'Maximum replica count (1-1000)'
          },
          namespace: {
            type: 'string',
            description: 'Kubernetes namespace (default: default)'
          },
          wait: {
            type: 'boolean',
            description: 'Whether to wait for HPA status update (default: false)'
          },
          timeout: {
            type: 'integer',
            description: 'Wait timeout in seconds (default: 120)',
            minimum: 30,
            maximum: 600
          }
        },
        required: ['hpaName'],
        additionalProperties: false,
        description: 'Note: Both minReplicas and maxReplicas are optional parameters, just provide the parameters you want to modify'
      }
    };
  }

  async execute(args) {
    try {
      // According to k8s-mcp-server.mdc specification, all inputs must pass validation
      this.validateInput(args);

      const {
        hpaName,
        minReplicas,
        maxReplicas,
        namespace = 'default',
        wait = false,
        timeout = 120
      } = args;

      // Additional business logic validation (following security requirements)
      if (minReplicas !== undefined) {
        if (!Number.isInteger(minReplicas) || minReplicas < 1 || minReplicas > 100) {
          throw new Error(`minReplicas must be an integer between 1-100, but received: ${minReplicas}`);
        }
      }

      if (maxReplicas !== undefined) {
        if (!Number.isInteger(maxReplicas) || maxReplicas < 1 || maxReplicas > 1000) {
          throw new Error(`maxReplicas must be an integer between 1-1000, but received: ${maxReplicas}`);
        }
      }

      if (minReplicas !== undefined && maxReplicas !== undefined) {
        if (minReplicas > maxReplicas) {
          throw new Error(`Minimum replica count (${minReplicas}) cannot be greater than maximum replica count (${maxReplicas})`);
        }
      }

      // Ensure at least one parameter needs modification
      if (minReplicas === undefined && maxReplicas === undefined) {
        throw new Error('Must provide minReplicas or maxReplicas parameter');
      }

      // Check if HPA exists and get current state
      const beforeState = await this.getHpaState(hpaName, namespace);

      // Validate if new range is reasonable
      const newMinReplicas = minReplicas !== undefined ? minReplicas : beforeState.minReplicas;
      const newMaxReplicas = maxReplicas !== undefined ? maxReplicas : beforeState.maxReplicas;

      if (newMinReplicas > newMaxReplicas) {
        throw new Error(`New minimum replica count (${newMinReplicas}) cannot be greater than maximum replica count (${newMaxReplicas})`);
      }

      // Check if there are actual changes
      if (newMinReplicas === beforeState.minReplicas && newMaxReplicas === beforeState.maxReplicas) {
        throw new Error('No parameters need updating, current HPA configuration is already the specified values');
      }

      // Execute HPA edit operation
      await this.editHpa(hpaName, namespace, newMinReplicas, newMaxReplicas, beforeState.minReplicas, beforeState.maxReplicas);

      // If wait is needed, wait for HPA status update
      let afterState;
      if (wait) {
        afterState = await this.waitForHpaUpdate(hpaName, namespace, timeout, newMinReplicas, newMaxReplicas);
      } else {
        // Brief wait then get status
        await this.sleep(2000);
        afterState = await this.getHpaState(hpaName, namespace);
      }

      // Format final result
      const result = this.formatEditResult(beforeState, afterState, wait, {
        minReplicas: newMinReplicas,
        maxReplicas: newMaxReplicas
      });

      this.logSuccess(args, result);
      return this.createResponse(result);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(error.message);
    }
  }

  async getHpaState(hpaName, namespace) {
    try {
      const command = ['get', 'hpa', hpaName, '-n', namespace, '-o', 'json'];
      const result = await kubectl.execute(command);

      const hpa = JSON.parse(result);

      return {
        name: hpa.metadata.name,
        namespace: hpa.metadata.namespace,
        minReplicas: hpa.spec.minReplicas || 1,
        maxReplicas: hpa.spec.maxReplicas || 10,
        currentReplicas: hpa.status.currentReplicas || 0,
        desiredReplicas: hpa.status.desiredReplicas || 0,
        targetCPUUtilizationPercentage: hpa.spec.targetCPUUtilizationPercentage || null,
        scaleTargetRef: hpa.spec.scaleTargetRef || {},
        conditions: hpa.status.conditions || [],
        lastScaleTime: hpa.status.lastScaleTime || null,
        generation: hpa.metadata.generation || 0,
        observedGeneration: hpa.status.observedGeneration || 0
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new Error(`HorizontalPodAutoscaler "${hpaName}" does not exist in namespace "${namespace}". Please confirm the HPA name and namespace are correct.`);
      }
      throw new Error(`Unable to get HPA status: ${error.message}`);
    }
  }

  async editHpa(hpaName, namespace, minReplicas, maxReplicas, originalMinReplicas, originalMaxReplicas) {
    try {
      // Use temporary file method to avoid JSON quote issues in shell
      // Following k8s-mcp-server security specification, use --patch-file option

      // Only include fields that actually need modification
      const patchData = {
        spec: {}
      };

      // Only include in patch if value differs from original
      if (minReplicas !== originalMinReplicas) {
        patchData.spec.minReplicas = minReplicas;
      }

      if (maxReplicas !== originalMaxReplicas) {
        patchData.spec.maxReplicas = maxReplicas;
      }

      // Create temporary file
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `hpa-patch-${Date.now()}.json`);

      try {
        // Write patch data to temporary file
        await fs.writeFile(tempFile, JSON.stringify(patchData, null, 2));

        // Use --patch-file parameter to avoid command line JSON quote issues
        const command = ['patch', 'hpa', hpaName, '-n', namespace, '--patch-file', tempFile, '--type', 'strategic'];
        await kubectl.execute(command);

      } finally {
        // Always clean up temporary file
        try {
          await fs.unlink(tempFile);
        } catch (cleanupError) {
          // Ignore cleanup errors, don't affect main operation
        }
      }

    } catch (error) {
      throw new Error(`Failed to edit HPA: ${error.message}`);
    }
  }

  async waitForHpaUpdate(hpaName, namespace, timeout, expectedMinReplicas, expectedMaxReplicas) {
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const state = await this.getHpaState(hpaName, namespace);

        // Check if updated to expected value
        if (state.minReplicas === expectedMinReplicas &&
            state.maxReplicas === expectedMaxReplicas &&
            state.observedGeneration >= state.generation) {
          return state;
        }

        // Wait 2 seconds then retry
        await this.sleep(2000);
      } catch (error) {
        // If getting status fails, wait a bit then retry
        await this.sleep(3000);
      }
    }

    // Timeout, get final status
    const finalState = await this.getHpaState(hpaName, namespace);
    finalState.timeout = true;
    return finalState;
  }

  formatEditResult(beforeState, afterState, waited, expectedValues) {
    let result = `HorizontalPodAutoscaler edit operation result\n`;
    result += `==================================================\n\n`;

    // Operation summary
    result += `Operation Summary:\n`;
    result += `• HPA: ${beforeState.name}\n`;
    result += `• Namespace: ${beforeState.namespace}\n`;
    result += `• Scale Target: ${beforeState.scaleTargetRef.kind}/${beforeState.scaleTargetRef.name}\n`;
    result += `• Operation Type: Replica count range adjustment\n\n`;

    // Change details
    result += `Change Details:\n`;

    // Only show items with actual changes
    if (beforeState.minReplicas !== expectedValues.minReplicas) {
      result += `• Minimum replicas: ${beforeState.minReplicas} → ${expectedValues.minReplicas}`;
      const change = expectedValues.minReplicas - beforeState.minReplicas;
      result += ` (${change > 0 ? '+' : ''}${change})`;
      result += `\n`;
    } else {
      result += `• Minimum replicas: ${beforeState.minReplicas} (no change)\n`;
    }

    if (beforeState.maxReplicas !== expectedValues.maxReplicas) {
      result += `• Maximum replicas: ${beforeState.maxReplicas} → ${expectedValues.maxReplicas}`;
      const change = expectedValues.maxReplicas - beforeState.maxReplicas;
      result += ` (${change > 0 ? '+' : ''}${change})`;
      result += `\n`;
    } else {
      result += `• Maximum replicas: ${beforeState.maxReplicas} (no change)\n`;
    }
    result += `\n`;

    // Detailed status comparison
    result += `Status Comparison:\n`;
    result += `┌────────────────────┬──────────┬──────────┐\n`;
    result += `│ Item               │ Before   │ After    │\n`;
    result += `├────────────────────┼──────────┼──────────┤\n`;
    result += `│ Min Replicas       │ ${beforeState.minReplicas.toString().padEnd(8)} │ ${afterState.minReplicas.toString().padEnd(8)} │\n`;
    result += `│ Max Replicas       │ ${beforeState.maxReplicas.toString().padEnd(8)} │ ${afterState.maxReplicas.toString().padEnd(8)} │\n`;
    result += `│ Current Replicas   │ ${beforeState.currentReplicas.toString().padEnd(8)} │ ${afterState.currentReplicas.toString().padEnd(8)} │\n`;
    result += `│ Desired Replicas   │ ${beforeState.desiredReplicas.toString().padEnd(8)} │ ${afterState.desiredReplicas.toString().padEnd(8)} │\n`;
    result += `│ Generation         │ ${beforeState.generation.toString().padEnd(8)} │ ${afterState.generation.toString().padEnd(8)} │\n`;
    result += `│ Observed Generation│ ${beforeState.observedGeneration.toString().padEnd(8)} │ ${afterState.observedGeneration.toString().padEnd(8)} │\n`;
    result += `└────────────────────┴──────────┴──────────┘\n\n`;

    // Operation result analysis
    result += `Operation Results:\n`;

    if (afterState.timeout) {
      result += `[Warning] Wait timeout, HPA update may still be in progress\n`;
    }

    if (afterState.minReplicas === expectedValues.minReplicas &&
        afterState.maxReplicas === expectedValues.maxReplicas) {
      result += `[Success] HPA spec successfully updated to target values\n`;
    } else {
      result += `[Warning] HPA spec may not have been fully updated\n`;
    }

    if (afterState.observedGeneration >= afterState.generation) {
      result += `[Success] Controller has observed the latest spec\n`;
    } else {
      result += `[In Progress] Controller is processing spec update\n`;
    }

    // Scaling impact analysis
    const currentReplicas = afterState.currentReplicas;
    if (currentReplicas < afterState.minReplicas) {
      result += `[Info] Current replica count (${currentReplicas}) is below new minimum, HPA may trigger scale up\n`;
    } else if (currentReplicas > afterState.maxReplicas) {
      result += `[Info] Current replica count (${currentReplicas}) exceeds new maximum, HPA may trigger scale down\n`;
    } else {
      result += `[Normal] Current replica count is within new range, HPA will adjust dynamically based on metrics\n`;
    }

    // Wait information
    if (waited) {
      result += `\nWait Information:\n`;
      if (afterState.timeout) {
        result += `• Wait timeout reached, recommend checking status later\n`;
      } else {
        result += `• Waited for HPA spec update completion\n`;
      }
    } else {
      result += `\nTips:\n`;
      result += `• This operation did not wait for completion, HPA may still be updating\n`;
    }

    result += `• Use kubectl_get to check HPA status: {"resource": "hpa", "namespace": "${afterState.namespace}", "name": "${afterState.name}"}\n`;
    result += `• Use kubectl_get to check target Deployment: {"resource": "deployments", "namespace": "${afterState.namespace}"}\n`;
    result += `• Use kubectl_describe for detailed information: {"resource": "hpa", "name": "${afterState.name}", "namespace": "${afterState.namespace}"}\n`;
    result += `• HPA will automatically adjust replica count within ${afterState.minReplicas}-${afterState.maxReplicas} range based on CPU utilization`;

    return result;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}