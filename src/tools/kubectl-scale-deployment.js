/**
 * Scale Kubernetes Deployment replicas
 * Support dynamic adjustment of Deployment replicas with safety validation and wait mechanism
 */

import { BaseTool } from './base-tool.js';
import { KubernetesCommandRunner } from '../utils/command-runner.js';

export class KubectlScaleDeploymentTool extends BaseTool {
  constructor() {
    super('kubectl_scale_deployment', 'Scale the number of replicas for Kubernetes Deployment');
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
          replicas: {
            type: 'integer',
            description: 'Target replica count (0-100)',
            minimum: 0,
            maximum: 100
          },
          namespace: {
            type: 'string',
            description: 'Kubernetes namespace (default: default)'
          },
          wait: {
            type: 'boolean',
            description: 'Whether to wait for scaling to complete (default: false)'
          },
          timeout: {
            type: 'integer',
            description: 'Wait timeout in seconds (default: 300)',
            minimum: 30,
            maximum: 1800
          }
        },
        required: ['deploymentName', 'replicas']
      }
    };
  }

  async execute(args) {
    try {
      const {
        deploymentName,
        replicas,
        namespace = 'default',
        wait = false,
        timeout = 300
      } = args;

      const runner = new KubernetesCommandRunner();

      // Check if Deployment exists and get current state
      const currentState = await this.getDeploymentState(deploymentName, namespace, runner);

      // Execute scaling operation
      await this.scaleDeployment(deploymentName, replicas, namespace, runner);

      // If wait is required, wait for scaling to complete
      let afterState;
      if (wait) {
        afterState = await this.waitForScaleComplete(deploymentName, replicas, namespace, timeout, runner);
      } else {
        // Brief wait then get state
        await this.sleep(2000);
        afterState = await this.getDeploymentState(deploymentName, namespace, runner);
      }

      // Format final result
      const result = this.formatScaleResult(currentState, afterState, replicas, wait);

      return this.createResponse(result);

    } catch (error) {
      return this.createErrorResponse(error.message);
    }
  }

  async getDeploymentState(deploymentName, namespace, runner) {
    try {
      const command = ['get', 'deployment', deploymentName, '-n', namespace, '-o', 'json'];
      const result = await runner.run('kubectl', command);

      const deployment = JSON.parse(result.stdout);

      return {
        name: deployment.metadata.name,
        namespace: deployment.metadata.namespace,
        currentReplicas: deployment.status.replicas || 0,
        readyReplicas: deployment.status.readyReplicas || 0,
        availableReplicas: deployment.status.availableReplicas || 0,
        desiredReplicas: deployment.spec.replicas || 0,
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

  async scaleDeployment(deploymentName, replicas, namespace, runner) {
    try {
      const command = ['scale', 'deployment', deploymentName, '--replicas', replicas.toString(), '-n', namespace];
      await runner.run('kubectl', command);
    } catch (error) {
      throw new Error(`Failed to scale Deployment: ${error.message}`);
    }
  }

  async waitForScaleComplete(deploymentName, targetReplicas, namespace, timeout, runner) {
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const state = await this.getDeploymentState(deploymentName, namespace, runner);

        // Check if target state is reached
        if (targetReplicas === 0) {
          // Scaling down to 0: check if current replicas is 0
          if (state.currentReplicas === 0) {
            return state;
          }
        } else {
          // Scaling up: check if ready replicas reaches target
          if (state.readyReplicas === targetReplicas && state.availableReplicas === targetReplicas) {
            return state;
          }
        }

        // Wait 2 seconds before retry
        await this.sleep(2000);
      } catch (error) {
        // If getting state fails, wait a bit and retry
        await this.sleep(3000);
      }
    }

    // Timeout, get final state
    const finalState = await this.getDeploymentState(deploymentName, namespace, runner);
    finalState.timeout = true;
    return finalState;
  }

  formatScaleResult(beforeState, afterState, targetReplicas, waited) {
    let result = `Deployment Scaling Operation Result\n`;
    result += `==================================================\n\n`;

    // Operation summary
    result += `Operation Summary:\n`;
    result += `• Deployment: ${beforeState.name}\n`;
    result += `• Namespace: ${beforeState.namespace}\n`;
    result += `• Original replicas: ${beforeState.desiredReplicas} → Target replicas: ${targetReplicas}\n`;
    result += `• Change: ${targetReplicas > beforeState.desiredReplicas ? 'Scale up' : targetReplicas < beforeState.desiredReplicas ? 'Scale down' : 'No change'} `;

    if (targetReplicas !== beforeState.desiredReplicas) {
      const change = Math.abs(targetReplicas - beforeState.desiredReplicas);
      result += `(${targetReplicas > beforeState.desiredReplicas ? '+' : '-'}${change} replicas)\n\n`;
    } else {
      result += '\n\n';
    }

    // Detailed state comparison
    result += `State Comparison:\n`;
    result += `┌────────────────────┬──────────┬──────────┐\n`;
    result += `│ Item               │ Before   │ After    │\n`;
    result += `├────────────────────┼──────────┼──────────┤\n`;
    result += `│ Desired replicas   │ ${beforeState.desiredReplicas.toString().padEnd(8)} │ ${afterState.desiredReplicas.toString().padEnd(8)} │\n`;
    result += `│ Current replicas   │ ${beforeState.currentReplicas.toString().padEnd(8)} │ ${afterState.currentReplicas.toString().padEnd(8)} │\n`;
    result += `│ Ready replicas     │ ${beforeState.readyReplicas.toString().padEnd(8)} │ ${afterState.readyReplicas.toString().padEnd(8)} │\n`;
    result += `│ Available replicas │ ${beforeState.availableReplicas.toString().padEnd(8)} │ ${afterState.availableReplicas.toString().padEnd(8)} │\n`;
    result += `└────────────────────┴──────────┴──────────┘\n\n`;

    // Operation result analysis
    result += `Operation Result:\n`;

    if (afterState.timeout) {
      result += `[Warning] Wait timeout, scaling operation may still be in progress\n`;
    }

    if (afterState.desiredReplicas === targetReplicas) {
      result += `[Success] Deployment spec successfully updated to target replica count\n`;
    } else {
      result += `[Failed] Deployment spec update failed\n`;
    }

    if (targetReplicas === 0) {
      if (afterState.currentReplicas === 0) {
        result += `[Success] All Pods have been terminated\n`;
      } else {
        result += `[In Progress] Terminating Pods, ${afterState.currentReplicas} replicas remaining\n`;
      }
    } else {
      if (afterState.readyReplicas === targetReplicas) {
        result += `[Success] All Pods are ready and available\n`;
      } else {
        result += `[In Progress] Starting Pods, ${afterState.readyReplicas}/${targetReplicas} replicas ready\n`;
      }
    }

    // Wait information
    if (waited) {
      result += `\nWait Information:\n`;
      if (afterState.timeout) {
        result += `• Waited for ${Math.floor(timeout)} seconds but operation did not complete\n`;
        result += `• You can check status again later with kubectl_get\n`;
      } else {
        result += `• Operation completed successfully within the wait period\n`;
      }
    } else {
      result += `\nNote:\n`;
      result += `• Scaling command has been executed, but final state may still be changing\n`;
      result += `• Use wait=true to wait for operation completion\n`;
      result += `• Use kubectl_get to check current status\n`;
    }

    result += `\nCommand Equivalent:\n`;
    result += `kubectl scale deployment ${beforeState.name} --replicas=${targetReplicas} -n ${beforeState.namespace}`;

    return result;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}