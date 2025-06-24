/**
 * Get Kubernetes resource YAML format output
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';

export class KubectlGetYamlTool extends BaseTool {
  constructor() {
    super('kubectl_get_yaml', 'Get YAML format output of Kubernetes resources for configuration inspection, backup or debugging');
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
            description: 'Resource type to get',
            enum: [
              'pods', 'nodes', 'deployments', 'services', 'replicasets',
              'daemonsets', 'statefulsets', 'jobs', 'cronjobs',
              'configmaps', 'secrets', 'pv', 'pvc', 'ingress', 'hpa',
              'namespaces', 'events', 'serviceaccounts', 'clusterroles', 'clusterrolebindings'
            ]
          },
          name: {
            type: 'string',
            description: 'Resource name (optional, if not provided gets all resources)'
          },
          namespace: {
            type: 'string',
            description: 'Namespace (only applicable to namespace-scoped resources)'
          },
          allNamespaces: {
            type: 'boolean',
            description: 'Whether to view resources from all namespaces'
          }
        },
        required: ['resource']
      }
    };
  }

  async execute(args) {
    try {
      const { resource, name, namespace, allNamespaces } = args;

      // Validate parameter combination
      this.validateParameterCombination(resource, namespace, allNamespaces);

      // Build kubectl command
      const command = this.buildKubectlCommand(resource, name, namespace, allNamespaces);

      // Execute command
      const result = await kubectl.execute(command);

      return this.createResponse(result);

    } catch (error) {
      return this.createErrorResponse(error.message);
    }
  }

  validateParameterCombination(resource, namespace, allNamespaces) {
    // namespace and allNamespaces cannot be used together
    if (namespace && allNamespaces) {
      throw new Error('Cannot specify both namespace and allNamespaces parameters');
    }

    // cluster-scoped resources do not support namespace-related parameters
    const clusterScopedResources = ['nodes', 'pv', 'namespaces', 'clusterroles', 'clusterrolebindings'];
    if (clusterScopedResources.includes(resource)) {
      if (namespace) {
        throw new Error(`${resource} is a cluster-scoped resource, does not support namespace parameter`);
      }
      if (allNamespaces) {
        throw new Error(`${resource} is a cluster-scoped resource, does not support allNamespaces parameter`);
      }
    }
  }

  buildKubectlCommand(resource, name, namespace, allNamespaces) {
    let command = ['get', resource];

    // Add resource name
    if (name) {
      command.push(name);
    }

    // Add output format
    command.push('-o', 'yaml');

    // Add namespace parameters
    if (namespace) {
      command.push('--namespace', namespace);
    } else if (allNamespaces) {
      command.push('--all-namespaces');
    }

    return command;
  }
}