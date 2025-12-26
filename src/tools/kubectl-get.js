import { BaseTool, OUTPUT_MODES, DEFAULT_OUTPUT_MODE } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';
import { validator } from '../utils/validator.js';

export class KubectlGetTool extends BaseTool {
  constructor() {
    super('kubectl_get', 'Get Kubernetes resources (pods, nodes, deployments, services, replicasets, daemonsets, statefulsets, jobs, cronjobs, configmaps, secrets, pv, pvc, ingress, hpa, namespaces, events, serviceaccounts, clusterroles, clusterrolebindings) with label selector filtering support');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          resource: {
            type: 'string',
            description: 'Resource type',
            enum: ['pods', 'nodes', 'deployments', 'services', 'replicasets', 'daemonsets', 'statefulsets', 'jobs', 'cronjobs', 'configmaps', 'secrets', 'pv', 'pvc', 'ingress', 'hpa', 'namespaces', 'events', 'serviceaccounts', 'clusterroles', 'clusterrolebindings'],
          },
          namespace: {
            type: 'string',
            description: 'Namespace (applicable to all resources except nodes, pv, namespaces, clusterroles, clusterrolebindings)',
          },
          allNamespaces: {
            type: 'boolean',
            description: 'View resources across all namespaces (equivalent to kubectl -A parameter, not applicable to cluster-scoped resources)',
            default: false,
          },
          name: {
            type: 'string',
            description: 'Specific resource name (optional)',
          },
          labelSelector: {
            type: 'string',
            description: 'Label selector (e.g.: "app=nginx", "environment=prod,tier=frontend", "app!=test")',
          },
          labels: {
            type: 'object',
            description: 'Label key-value pairs object (e.g.: {"app": "nginx", "environment": "prod"})',
          },
          cluster: {
            type: 'string',
            description: 'Target cluster ID (optional, uses default cluster if not specified)',
          },
          outputMode: {
            type: 'string',
            enum: ['compact', 'normal', 'verbose'],
            description: 'Output detail level: compact (minimal, saves tokens), normal (balanced), verbose (full details). Default from MCP_OUTPUT_MODE env',
          },
        },
        required: ['resource'],
      },
    };
  }

  /**
   * Validate label selector format (using shared validator)
   */
  validateLabelSelector(labelSelector) {
    validator.validateLabelSelector(labelSelector);
  }

  /**
   * Validate labels object (using shared validator)
   */
  validateLabels(labels) {
    validator.validateLabelsObject(labels);
  }

  /**
   * Convert labels object to label selector string
   */
  convertLabelsToSelector(labels) {
    const selectors = [];
    for (const [key, value] of Object.entries(labels)) {
      if (value === '') {
        selectors.push(key);  // Only check key existence
      } else {
        selectors.push(`${key}=${value}`);
      }
    }
    return selectors.join(',');
  }

  async execute(args) {
    try {
      validator.validateInput(args, this.getDefinition().inputSchema);

      const { resource, namespace, allNamespaces, name, labelSelector, labels, cluster, outputMode = DEFAULT_OUTPUT_MODE } = args;

      // Validate cluster ID (if provided)
      if (cluster) {
        validator.validateClusterId(cluster);
      }

      // Added: Prerequisite check, if failed will directly throw error
      await this.validatePrerequisites(args);

      // Validate resource type
      const supportedResources = ['pods', 'nodes', 'deployments', 'services', 'replicasets', 'daemonsets', 'statefulsets', 'jobs', 'cronjobs', 'configmaps', 'secrets', 'pv', 'pvc', 'ingress', 'hpa', 'namespaces', 'events', 'serviceaccounts', 'clusterroles', 'clusterrolebindings'];
      if (!supportedResources.includes(resource)) {
        throw new Error(`Unsupported resource type: ${resource}, only supports ${supportedResources.join(', ')}`);
      }

      // cluster-scoped resources don't support namespace and allNamespaces
      const clusterScopedResources = ['nodes', 'pv', 'namespaces', 'clusterroles', 'clusterrolebindings'];
      if (clusterScopedResources.includes(resource)) {
        if (namespace) {
          throw new Error(`${resource} resource does not support namespace parameter (cluster-scoped resource)`);
        }
        // For cluster-scoped resources, silently ignore allNamespaces parameter instead of throwing error
        // This provides better user experience when querying resources like 'namespaces'
      }

      // namespace and allNamespaces cannot be used together
      if (namespace && allNamespaces) {
        throw new Error('namespace and allNamespaces parameters cannot be used together');
      }

      // labelSelector and labels cannot be used together
      if (labelSelector && labels) {
        throw new Error('labelSelector and labels parameters cannot be used together, please choose one approach');
      }

      // Validate label parameters
      let finalLabelSelector = null;
      if (labelSelector) {
        this.validateLabelSelector(labelSelector);
        finalLabelSelector = labelSelector;
      } else if (labels) {
        this.validateLabels(labels);
        finalLabelSelector = this.convertLabelsToSelector(labels);
      }

      // Build kubectl command
      const kubectlArgs = ['get', resource];

      // Handle namespace parameters
      if (allNamespaces && !clusterScopedResources.includes(resource)) {
        kubectlArgs.push('-A');
      } else if (namespace && !clusterScopedResources.includes(resource)) {
        kubectlArgs.push('-n', namespace);
      }

      if (name) {
        kubectlArgs.push(name);
      }

      // Add label selector
      if (finalLabelSelector) {
        kubectlArgs.push('-l', finalLabelSelector);
      }

      kubectlArgs.push('-o', 'json');

      // Pass cluster parameter
      // Execute command
      const result = await kubectl.execute(kubectlArgs, cluster);

      // Parse JSON result
      let jsonData;
      try {
        jsonData = JSON.parse(result);
      } catch (parseError) {
        throw new Error(`Unable to parse kubectl response: ${parseError.message}`);
      }

      // Log successful execution details
      const itemCount = jsonData.items ? jsonData.items.length : (jsonData.kind ? 1 : 0);
      const logDetails = {
        resource,
        namespace: namespace || 'default',
        allNamespaces,
        name,
        labelSelector: finalLabelSelector,
        cluster: cluster || 'default',
        itemCount,
        outputMode
      };

      this.logSuccess(args, { content: [{ text: `Found ${itemCount} resources` }] });

      // 根據 outputMode 處理輸出
      let outputData;
      switch (outputMode) {
        case 'compact':
          // 精簡模式：只返回摘要
          outputData = this.createResourceSummary(jsonData);
          break;
        case 'verbose':
          // 詳細模式：只移除 managedFields
          outputData = this.filterK8sMetadata(jsonData, OUTPUT_MODES.VERBOSE);
          break;
        case 'normal':
        default:
          // 標準模式：移除冗餘 metadata
          outputData = this.filterK8sMetadata(jsonData, OUTPUT_MODES.NORMAL);
          break;
      }

      return {
        content: [
          {
            type: 'json',
            json: outputData
          }
        ]
      };

    } catch (error) {
      this.logError(args, error);

      // If it is a prerequisite error, rethrow it directly for the MCP handler to process
      if (error.name === 'PrerequisiteError') {
        throw error;
      }

      return this.createErrorResponse(error.message);
    }
  }
}