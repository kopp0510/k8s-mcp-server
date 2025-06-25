/**
 * View Kubernetes container resource usage
 * Focus on container-level detailed monitoring and analysis, requires metrics-server support
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';
import { validator } from '../utils/validator.js';

export class KubectlTopContainersTool extends BaseTool {
  constructor() {
    super('kubectl_top_containers', 'View detailed CPU and memory usage of Kubernetes containers (requires metrics-server)');
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
            description: 'View containers across all namespaces (cannot be used with namespace)'
          },
          sortBy: {
            type: 'string',
            description: 'Sort method',
            enum: ['cpu', 'memory']
          },
          podName: {
            type: 'string',
            description: 'Filter containers from specific Pod'
          },
          containerName: {
            type: 'string',
            description: 'Filter containers containing specific name (fuzzy matching)'
          }
        },
        required: []
      }
    };
  }

  async execute(args) {
    try {
      validator.validateInput(args, this.getDefinition().inputSchema);

      const {
        namespace = 'default',
        allNamespaces,
        sortBy,
        podName,
        containerName
      } = args;

      // Validate parameter combination
      this.validateParameterCombination(namespace, allNamespaces);

      // Check if metrics-server is installed and running
      await this.checkMetricsServer();

      // Build kubectl top pods --containers command
      const command = this.buildTopCommand(namespace, allNamespaces, sortBy);

      // Execute command
      const result = await kubectl.execute(command);

      // Parse and filter container data
      const containerData = this.parseContainerData(result);
      const filteredData = this.filterContainerData(containerData, podName, containerName);

      // Format output
      const formattedResult = this.formatContainerOutput(filteredData, allNamespaces, args);

      this.logSuccess(args, formattedResult);
      return this.createResponse(formattedResult);

    } catch (error) {
      this.logError(args, error);

      // Check if it's a "no resources found" situation
      if (error.message.includes('No resources found')) {
        const namespaceInfo = allNamespaces ? 'across all namespaces' : `in namespace "${namespace}"`;
        return this.createResponse(`No running containers found ${namespaceInfo}.\n\nTips:\n• Ensure there are running Pods in the specified namespace\n• Use kubectl_get to view Pod list: {"resource": "pods", "namespace": "${namespace}"}\n• If this is a new cluster, you may need to deploy some applications first`);
      }

      return this.createErrorResponse(error.message);
    }
  }

  validateParameterCombination(namespace, allNamespaces) {
    if (namespace !== 'default' && allNamespaces) {
      throw new Error('Cannot specify both namespace and allNamespaces parameters');
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

  buildTopCommand(namespace, allNamespaces, sortBy) {
    let command = ['top', 'pods', '--containers'];

    // Add namespace parameter
    if (allNamespaces) {
      command.push('--all-namespaces');
    } else {
      command.push('-n', namespace);
    }

    // Add sort parameter
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

  parseContainerData(rawOutput) {
    const lines = rawOutput.trim().split('\n');

    if (lines.length < 2) {
      return [];
    }

    const header = lines[0];
    const dataLines = lines.slice(1);

    // Check if NAMESPACE column exists
    const hasNamespace = header.includes('NAMESPACE');

    return dataLines.map(line => {
      const parts = line.trim().split(/\s+/);

      if (hasNamespace) {
        // Format: NAMESPACE POD NAME CPU(cores) MEMORY(bytes)
        return {
          namespace: parts[0],
          pod: parts[1],
          container: parts[2],
          cpu: parts[3],
          memory: parts[4]
        };
      } else {
        // Format: POD NAME CPU(cores) MEMORY(bytes)
        return {
          namespace: null,
          pod: parts[0],
          container: parts[1],
          cpu: parts[2],
          memory: parts[3]
        };
      }
    });
  }

  filterContainerData(containerData, podName, containerName) {
    let filtered = containerData;

    // Filter by Pod name
    if (podName) {
      filtered = filtered.filter(container =>
        container.pod === podName
      );
    }

    // Filter by container name (fuzzy matching)
    if (containerName) {
      filtered = filtered.filter(container =>
        container.container.toLowerCase().includes(containerName.toLowerCase())
      );
    }

    return filtered;
  }

  formatContainerOutput(containerData, allNamespaces, args) {
    if (containerData.length === 0) {
      const filters = [];
      if (args.podName) filters.push(`Pod: ${args.podName}`);
      if (args.containerName) filters.push(`container name contains: ${args.containerName}`);

      const filterText = filters.length > 0 ? `(filtered conditions: ${filters.join(', ')})` : '';
      return `No container resource usage information found ${filterText}`;
    }

    let formatted = `Container resource usage\n`;
    formatted += `==================================================\n\n`;

    // Statistics information
    formatted += `Found ${containerData.length} container resource usage information:\n`;

    // Calculate statistics data
    const stats = this.calculateStats(containerData);
    formatted += `\nStatistics summary:\n`;
    formatted += `• Total CPU usage: ${stats.totalCpu}m\n`;
    formatted += `• Total memory usage: ${stats.totalMemory}Mi\n`;
    formatted += `• Average CPU usage: ${stats.avgCpu}m\n`;
    formatted += `• Average memory usage: ${stats.avgMemory}Mi\n`;
    formatted += `• Number of involved Pods: ${stats.uniquePods}\n\n`;

    // Table title
    if (allNamespaces) {
      formatted += `NAMESPACE            POD                                      CONTAINER                CPU(cores)   MEMORY(bytes)\n`;
      formatted += `============================================================================================\n`;
    } else {
      formatted += `POD                                      CONTAINER                CPU(cores)   MEMORY(bytes)\n`;
      formatted += `===================================================================================\n`;
    }

    // Container data
    containerData.forEach(container => {
      if (allNamespaces) {
        formatted += `${container.namespace.padEnd(20)} ${container.pod.padEnd(40)} ${container.container.padEnd(20)} ${container.cpu.padEnd(12)} ${container.memory}\n`;
      } else {
        formatted += `${container.pod.padEnd(40)} ${container.container.padEnd(20)} ${container.cpu.padEnd(12)} ${container.memory}\n`;
      }
    });

    // Add explanation
    formatted += `\nExplanation:\n`;
    formatted += `• CPU usage is in millicores (m), 1000m = 1 CPU core\n`;
    formatted += `• Memory usage is in Mi (Mebibytes)\n`;
    formatted += `• Each line displays resource usage information for one container\n`;
    formatted += `• Format: POD_NAME/CONTAINER_NAME\n`;

    if (allNamespaces) {
      formatted += `• Containers across all namespaces\n`;
    }

    // Filtered conditions explanation
    if (args.podName || args.containerName) {
      formatted += `\nFiltered conditions:\n`;
      if (args.podName) formatted += `• Pod name: ${args.podName}\n`;
      if (args.containerName) formatted += `• Container name contains: ${args.containerName}\n`;
    }

    formatted += `\nTips:\n`;
    formatted += `• Use sortBy parameter to sort by cpu or memory\n`;
    formatted += `• Use podName parameter to filter containers from specific Pod\n`;
    formatted += `• Use containerName parameter to filter containers containing specific name\n`;
    formatted += `• Use kubectl_top_pods to view resource usage information at Pod level\n`;
    formatted += `• Use kubectl_top_nodes to view resource usage information at node level`;

    return formatted;
  }

  calculateStats(containerData) {
    const cpuValues = containerData.map(c => parseInt(c.cpu.replace('m', '')) || 0);
    const memoryValues = containerData.map(c => parseInt(c.memory.replace('Mi', '')) || 0);
    const uniquePods = new Set(containerData.map(c => c.pod)).size;

    return {
      totalCpu: cpuValues.reduce((sum, val) => sum + val, 0),
      totalMemory: memoryValues.reduce((sum, val) => sum + val, 0),
      avgCpu: Math.round(cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length || 0),
      avgMemory: Math.round(memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length || 0),
      uniquePods
    };
  }
}