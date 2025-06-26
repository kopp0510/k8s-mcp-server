/**
 * Restart Kubernetes Deployment
 * Support safe restart of Deployment, triggering Pod recreation and deployment
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';
import { validator } from '../utils/validator.js';

export class KubectlRestartDeploymentTool extends BaseTool {
  constructor() {
    super('kubectl_restart_deployment', 'Restart Kubernetes Deployment');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          deploymentName: {
            type: 'string',
            description: 'Deployment name'
          },
          namespace: {
            type: 'string',
            description: 'Kubernetes namespace (default: default)'
          },
          wait: {
            type: 'boolean',
            description: 'Whether to wait for restart to complete (default: false)'
          },
          timeout: {
            type: 'integer',
            description: 'Wait timeout in seconds (default: 300)',
            minimum: 30,
            maximum: 1800
          },
          cluster: {
            type: 'string',
            description: '指定要操作的叢集 ID（可選，預設使用當前叢集）',
            minLength: 1,
            maxLength: 64
          }
        },
        required: ['deploymentName']
      }
    };
  }

  async execute(args) {
    try {
      const {
        deploymentName,
        namespace = 'default',
        wait = false,
        timeout = 300,
        cluster
      } = args;

      // 驗證叢集參數
      if (cluster) {
        validator.validateClusterId(cluster);
      }

      // Check if Deployment exists and get current state
      const beforeState = await this.getDeploymentState(deploymentName, namespace, cluster);

      // Execute restart operation
      await this.restartDeployment(deploymentName, namespace, cluster);

      // If wait is required, wait for restart to complete
      let afterState;
      if (wait) {
        afterState = await this.waitForRestartComplete(deploymentName, namespace, timeout, beforeState.generation, cluster);
      } else {
        // Brief wait then get state
        await this.sleep(3000);
        afterState = await this.getDeploymentState(deploymentName, namespace, cluster);
      }

      // Format final result
      const result = this.formatRestartResult(beforeState, afterState, wait);

      return this.createResponse(result);

    } catch (error) {
      return this.createErrorResponse(error.message);
    }
  }

  async getDeploymentState(deploymentName, namespace, cluster) {
    try {
      const command = ['get', 'deployment', deploymentName, '-n', namespace, '-o', 'json'];
      const result = await kubectl.execute(command, cluster);

      const deployment = JSON.parse(result);

      return {
        name: deployment.metadata.name,
        namespace: deployment.metadata.namespace,
        generation: deployment.metadata.generation || 0,
        observedGeneration: deployment.status.observedGeneration || 0,
        replicas: deployment.spec.replicas || 0,
        currentReplicas: deployment.status.replicas || 0,
        readyReplicas: deployment.status.readyReplicas || 0,
        availableReplicas: deployment.status.availableReplicas || 0,
        updatedReplicas: deployment.status.updatedReplicas || 0,
        conditions: deployment.status.conditions || [],
        creationTimestamp: deployment.metadata.creationTimestamp
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new Error(`Deployment "${deploymentName}" does not exist in namespace "${namespace}". Please verify the Deployment name and namespace.`);
      }
      throw new Error(`Unable to get Deployment state: ${error.message}`);
    }
  }

  async restartDeployment(deploymentName, namespace, cluster) {
    try {
      const command = ['rollout', 'restart', 'deployment', deploymentName, '-n', namespace];
      await kubectl.execute(command, cluster);
    } catch (error) {
      throw new Error(`Failed to restart Deployment: ${error.message}`);
    }
  }

  async waitForRestartComplete(deploymentName, namespace, timeout, originalGeneration, cluster) {
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const state = await this.getDeploymentState(deploymentName, namespace, cluster);

        // Check if restart is complete
        // 1. generation should be greater than original value (spec updated)
        // 2. observedGeneration should equal new generation (controller observed update)
        // 3. updatedReplicas should equal desired replicas (all Pods updated)
        // 4. readyReplicas should equal desired replicas (all Pods ready)
        if (state.generation > originalGeneration &&
            state.observedGeneration === state.generation &&
            state.updatedReplicas === state.replicas &&
            state.readyReplicas === state.replicas &&
            state.availableReplicas === state.replicas) {
          return state;
        }

        // Wait 3 seconds before retry
        await this.sleep(3000);
      } catch (error) {
        // If getting status fails, wait before retry
        await this.sleep(5000);
      }
    }

    // Timeout, get final status
    const finalState = await this.getDeploymentState(deploymentName, namespace, cluster);
    finalState.timeout = true;
    return finalState;
  }

  formatRestartResult(beforeState, afterState, waited) {
    let result = `Deployment Restart Operation Result\n`;
    result += `==================================================\n\n`;

    // Operation Summary
    result += `Operation Summary:\n`;
    result += `• Deployment: ${beforeState.name}\n`;
    result += `• Namespace: ${beforeState.namespace}\n`;
    result += `• Replicas: ${beforeState.replicas}\n`;
    result += `• Operation Type: Rolling Restart\n\n`;

    // Version Information
    result += `Version Information:\n`;
    result += `• Pre-restart Generation: ${beforeState.generation}\n`;
    result += `• Post-restart Generation: ${afterState.generation}\n`;
    result += `• Version Change: ${afterState.generation > beforeState.generation ? 'Updated' : 'No Change'}\n\n`;

    // Detailed Status Comparison
    result += `Status Comparison:\n`;
    result += `┌────────────────────┬──────────┬──────────┐\n`;
    result += `│ Item               │ Before   │ After    │\n`;
    result += `├────────────────────┼──────────┼──────────┤\n`;
    result += `│ Generation         │ ${beforeState.generation.toString().padEnd(8)} │ ${afterState.generation.toString().padEnd(8)} │\n`;
    result += `│ Observed Generation│ ${beforeState.observedGeneration.toString().padEnd(8)} │ ${afterState.observedGeneration.toString().padEnd(8)} │\n`;
    result += `│ Total Replicas     │ ${beforeState.currentReplicas.toString().padEnd(8)} │ ${afterState.currentReplicas.toString().padEnd(8)} │\n`;
    result += `│ Updated Replicas   │ ${beforeState.updatedReplicas.toString().padEnd(8)} │ ${afterState.updatedReplicas.toString().padEnd(8)} │\n`;
    result += `│ Ready Replicas     │ ${beforeState.readyReplicas.toString().padEnd(8)} │ ${afterState.readyReplicas.toString().padEnd(8)} │\n`;
    result += `│ Available Replicas │ ${beforeState.availableReplicas.toString().padEnd(8)} │ ${afterState.availableReplicas.toString().padEnd(8)} │\n`;
    result += `└────────────────────┴──────────┴──────────┘\n\n`;

    // Operation Result Analysis
    result += `Operation Results:\n`;

    if (afterState.timeout) {
      result += `[Warning] Wait timeout, restart operation may still be in progress\n`;
    }

    if (afterState.generation > beforeState.generation) {
      result += `[Success] Deployment spec successfully updated, rolling restart triggered\n`;
    } else {
      result += `[Warning] Deployment spec may not have been updated\n`;
    }

    if (afterState.observedGeneration === afterState.generation) {
      result += `[Success] Controller has observed the latest spec\n`;
    } else {
      result += `[In Progress] Controller is processing spec update\n`;
    }

    if (afterState.updatedReplicas === afterState.replicas) {
      result += `[Success] All Pods updated to latest version\n`;
    } else {
      result += `[In Progress] Updating Pods, ${afterState.updatedReplicas}/${afterState.replicas} replicas updated\n`;
    }

    if (afterState.readyReplicas === afterState.replicas) {
      result += `[Success] All Pods ready and available\n`;
    } else {
      result += `[In Progress] Starting Pods, ${afterState.readyReplicas}/${afterState.replicas} replicas ready\n`;
    }

    // Wait Information
    if (waited) {
      result += `\nWait Information:\n`;
      if (afterState.timeout) {
        result += `• Wait timeout reached, recommend checking status later\n`;
      } else {
        result += `• Waited for restart completion\n`;
      }
    } else {
      result += `\nTips:\n`;
      result += `• This operation did not wait for completion, Pods may still be restarting\n`;
    }

    result += `• Use kubectl_get to check Deployment status: {"resource": "deployments", "namespace": "${afterState.namespace}", "name": "${afterState.name}"}\n`;
    result += `• Use kubectl_get to check Pod status: {"resource": "pods", "namespace": "${afterState.namespace}"}\n`;
    result += `• Use kubectl_describe for detailed information: {"resource": "deployment", "name": "${afterState.name}", "namespace": "${afterState.namespace}"}\n`;
    result += `• Use kubectl_logs to view new Pod logs`;

    return result;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}