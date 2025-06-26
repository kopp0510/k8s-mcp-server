/**
 * View Kubernetes Pod resource usage
 * Requires metrics-server support
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';
import { validator } from '../utils/validator.js';

export class KubectlTopPodsTool extends BaseTool {
  constructor() {
    super('kubectl_top_pods', 'View CPU and memory usage of Kubernetes Pods (requires metrics-server)');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          namespace: {
            type: 'string',
            description: 'Kubernetes namespace (default: default)'
          },
          allNamespaces: {
            type: 'boolean',
            description: 'View Pods from all namespaces (cannot be used with namespace)'
          },
          sortBy: {
            type: 'string',
            description: 'Sort order',
            enum: ['cpu', 'memory']
          },
          containers: {
            type: 'boolean',
            description: 'Show container-level resource usage'
          },
          cluster: {
            type: 'string',
            description: '指定要操作的叢集 ID（可選，預設使用當前叢集）',
            minLength: 1,
            maxLength: 64
          }
        },
        required: []
      }
    };
  }

  async execute(args) {
    try {
      const { namespace = 'default', allNamespaces, sortBy, containers, cluster } = args;

      // 驗證叢集參數
      if (cluster) {
        validator.validateClusterId(cluster);
      }

      // Validate parameter combination
      this.validateParameterCombination(namespace, allNamespaces);

      // Check if metrics-server is installed and running
      await this.checkMetricsServer(cluster);

      // Build kubectl top pods command
      const command = this.buildTopCommand(namespace, allNamespaces, sortBy, containers);

      // Execute command with cluster support
      const result = await kubectl.execute(command, cluster);

      // Format output
      const formattedResult = this.formatTopOutput(result, allNamespaces, containers);

      return this.createResponse(formattedResult);

    } catch (error) {
      // Check if it's a "no resources found" situation
      if (error.message.includes('No resources found')) {
        const namespaceInfo = allNamespaces ? 'all namespaces' : `namespace "${namespace}"`;
        return this.createResponse(`No running Pods found in ${namespaceInfo}.\n\nTips:\n• Ensure there are running Pods in the specified namespace\n• Use kubectl_get to view Pod list: {"resource": "pods", "namespace": "${namespace}"}\n• For new clusters, you may need to deploy some applications first`);
      }

      return this.createErrorResponse(error.message);
    }
  }

  validateParameterCombination(namespace, allNamespaces) {
    if (namespace !== 'default' && allNamespaces) {
      throw new Error('Cannot specify both namespace and allNamespaces parameters');
    }
  }

  async checkMetricsServer(cluster) {
    try {
      // Check if metrics-server deployment exists
      const checkCommand = ['get', 'deployment', 'metrics-server', '-n', 'kube-system', '-o', 'json'];
      const result = await kubectl.execute(checkCommand, cluster);

      const deployment = JSON.parse(result);

      // Check deployment status
      const status = deployment.status;
      const readyReplicas = status.readyReplicas || 0;
      const replicas = status.replicas || 0;

      if (readyReplicas === 0 || readyReplicas < replicas) {
        throw new Error(
          'metrics-server is installed but not ready. Please wait for metrics-server to fully start up and try again.\n' +
          'Check status: kubectl get pods -n kube-system -l k8s-app=metrics-server'
        );
      }

    } catch (error) {
      if (error.message.includes('not found')) {
        throw new Error(
          'metrics-server is not installed. kubectl top command requires metrics-server to work.\n\n' +
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

  buildTopCommand(namespace, allNamespaces, sortBy, containers) {
    let command = ['top', 'pods'];

    // Add namespace parameter
    if (allNamespaces) {
      command.push('--all-namespaces');
    } else {
      command.push('-n', namespace);
    }

    // Add sort parameter (kubectl top pods only supports cpu and memory)
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

    // Add container-level parameter
    if (containers) {
      command.push('--containers');
    }

    return command;
  }

  formatTopOutput(rawOutput, allNamespaces, containers) {
    const lines = rawOutput.trim().split('\n');

    if (lines.length < 2) {
      return 'No Pod resource usage information found';
    }

    // Parse header line
    const header = lines[0];
    const dataLines = lines.slice(1);

    let formatted = `Pod Resource Usage\n`;
    formatted += `==================================================\n\n`;

    // Show different summary based on mode
    if (containers) {
      formatted += `Found resource usage information for ${dataLines.length} containers:\n\n`;
    } else {
      formatted += `Found resource usage information for ${dataLines.length} Pods:\n\n`;
    }

    // Format table
    formatted += `${header}\n`;
    formatted += `${'='.repeat(header.length)}\n`;

    dataLines.forEach(line => {
      formatted += `${line}\n`;
    });

    // Add explanations
    formatted += `\nExplanation:\n`;
    formatted += `• CPU usage is in millicores (m), 1000m = 1 CPU core\n`;
    formatted += `• Memory usage is in Mi (Mebibytes)\n`;

    if (containers) {
      formatted += `• Shows detailed resource usage at container level\n`;
      formatted += `• Format: POD_NAME/CONTAINER_NAME\n`;
    } else {
      formatted += `• Shows resource usage at Pod level\n`;
    }

    if (allNamespaces) {
      formatted += `• Data from all namespaces\n`;
    } else {
      formatted += `• Data from the specified namespace only\n`;
    }

    formatted += `\nTips:\n`;
    formatted += `• Use sortBy parameter to sort by cpu or memory\n`;
    formatted += `• Use containers=true to view container-level resource usage\n`;
    formatted += `• Use kubectl_top_containers for more detailed container analysis`;

    return formatted;
  }
}