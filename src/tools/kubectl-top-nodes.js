/**
 * View Kubernetes node resource usage
 * Requires metrics-server support
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';
import { validator } from '../utils/validator.js';

export class KubectlTopNodesTool extends BaseTool {
  constructor() {
    super('kubectl_top_nodes', 'View CPU and memory usage of Kubernetes nodes (requires metrics-server)');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          sortBy: {
            type: 'string',
            description: 'Sort method',
            enum: ['cpu', 'memory']
          }
        },
        required: []
      }
    };
  }

  async execute(args) {
    try {
      validator.validateInput(args, this.getDefinition().inputSchema);

      const { sortBy } = args;

      // Check if metrics-server is installed and running
      await this.checkMetricsServer();

      // Build kubectl top nodes command
      const command = this.buildTopCommand(sortBy);

      // Execute command
      const result = await kubectl.execute(command);

      // Format output
      const formattedResult = this.formatTopOutput(result);

      this.logSuccess(args, formattedResult);
      return this.createResponse(formattedResult);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(error.message);
    }
  }

  async checkMetricsServer() {
    try {
      // Check if metrics-server deployment exists
      const checkCommand = ['get', 'deployment', 'metrics-server', '-n', 'kube-system', '-o', 'json'];
      const result = await kubectl.execute(checkCommand);

      const deployment = JSON.parse(result);

      // Check deployment status
      const status = deployment.status;
      const readyReplicas = status.readyReplicas || 0;
      const replicas = status.replicas || 0;

      if (readyReplicas === 0 || readyReplicas < replicas) {
        throw new Error(
          'metrics-server is installed but not ready. Please wait for metrics-server to fully start before trying again.\n' +
          'Check status: kubectl get pods -n kube-system -l k8s-app=metrics-server'
        );
      }

    } catch (error) {
      if (error.message.includes('not found')) {
        throw new Error(
          'metrics-server is not installed. kubectl top commands require metrics-server to work.\n\n' +
          'Installation methods:\n' +
          '1. Using official YAML:\n' +
          '   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml\n\n' +
          '2. Using Helm:\n' +
          '   helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/\n' +
          '   helm upgrade --install metrics-server metrics-server/metrics-server\n\n' +
          '3. For local development environments (like minikube, kind), you may need to add --kubelet-insecure-tls parameter'
        );
      }

      if (error.message.includes('not ready')) {
        throw error;
      }

      throw new Error(`Error checking metrics-server: ${error.message}`);
    }
  }

  buildTopCommand(sortBy) {
    let command = ['top', 'nodes'];

    // Add sort parameter (kubectl top nodes only supports cpu and memory)
    if (sortBy) {
      switch (sortBy) {
        case 'cpu':
          command.push('--sort-by=cpu');
          break;
        case 'memory':
          command.push('--sort-by=memory');
          break;
      }
    }

    return command;
  }

  formatTopOutput(rawOutput) {
    const lines = rawOutput.trim().split('\n');

    if (lines.length < 2) {
      return 'No node resource usage information found';
    }

    // Parse header line
    const header = lines[0];
    const nodeLines = lines.slice(1);

    let formatted = `Node Resource Usage\n`;
    formatted += `==================================================\n\n`;
    formatted += `Found resource usage information for ${nodeLines.length} nodes:\n\n`;

    // Format table
    formatted += `${header}\n`;
    formatted += `${'='.repeat(header.length)}\n`;

    nodeLines.forEach(line => {
      formatted += `${line}\n`;
    });

    formatted += `\nExplanation:\n`;
    formatted += `• CPU usage is in millicores (m), 1000m = 1 CPU core\n`;
    formatted += `• Memory usage is in Mi (Mebibytes)\n`;
    formatted += `• Percentages show usage relative to total node capacity\n\n`;
    formatted += `Tips:\n`;
    formatted += `• Use sortBy parameter to sort by cpu or memory\n`;
    formatted += `• Use kubectl_top_pods to view Pod-level resource usage`;

    return formatted;
  }
}