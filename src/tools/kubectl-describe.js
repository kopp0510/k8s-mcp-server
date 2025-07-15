import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';
import { validator } from '../utils/validator.js';
import { logger } from '../utils/logger.js';

/**
 * kubectl describe tool
 * Get detailed description information of Kubernetes resources
 */
export class KubectlDescribeTool extends BaseTool {
  constructor() {
    super('kubectl_describe');
  }

  getDefinition() {
    return {
      name: this.name,
      description: 'Get detailed description information of Kubernetes resources, including events, status and configuration',
      inputSchema: {
        type: 'object',
        properties: {
          resource: {
            type: 'string',
            enum: ['pod', 'node', 'service', 'deployment', 'configmap', 'secret', 'serviceaccount', 'clusterrole', 'clusterrolebinding'],
            description: 'Resource type'
          },
          name: {
            type: 'string',
            description: 'Resource name'
          },
          namespace: {
            type: 'string',
            description: 'Namespace (for namespaced resources, defaults to default)'
          },
          cluster: {
            type: 'string',
            description: 'Specify the cluster ID (optional, defaults to the current cluster)',
            minLength: 1,
            maxLength: 64
          }
        },
        required: ['resource', 'name']
      }
    };
  }

  async execute({ resource, name, namespace = 'default', cluster }) {
    // Define namespaced resource types (moved to top of function to avoid scope issues)
    const namespacedResources = ['pod', 'service', 'deployment', 'configmap', 'secret', 'serviceaccount'];

    try {
      logger.info(`Starting kubectl describe: ${resource}/${name}`, { resource, name, namespace, cluster });

      // Validate input
      validator.validateInput({ resource, name, namespace, cluster });

      // Validate cluster parameter
      if (cluster) {
        validator.validateClusterId(cluster);
      }

      // Added: Prerequisite check
      await this.validatePrerequisites({ cluster });

      // Validate resource name
      validator.validateResourceName(name);

      // For namespaced resources, validate namespace
      if (namespacedResources.includes(resource)) {
        validator.validateNamespace(namespace);
      }

      logger.info(`Validation completed for ${resource}/${name}`);

      // First check if resource exists
      try {
        logger.info(`Checking if ${resource}/${name} exists`);
        const checkArgs = ['get', resource, name];
        if (namespacedResources.includes(resource)) {
          checkArgs.push('-n', namespace);
        }
        checkArgs.push('--no-headers');
        await kubectl.execute(checkArgs, cluster);
        logger.info(`Resource ${resource}/${name} exists`);
      } catch (error) {
        logger.warn(`Resource ${resource}/${name} not found:`, error.message);
        let errorMessage = `${resource} "${name}" not found`;
        if (namespacedResources.includes(resource)) {
          errorMessage += ` in namespace "${namespace}"`;
        }
        errorMessage += '. Please verify:';
        errorMessage += `\n1. The ${resource} name is correct`;
        if (namespacedResources.includes(resource)) {
          errorMessage += '\n2. The namespace is correct';
        }
        errorMessage += `\n3. You have permissions to access this ${resource}`;
        errorMessage += '\n\nTip: Use kubectl_get to list available resources:';
        errorMessage += `\n• List all ${resource}s: {"resource": "${resource}s"${namespacedResources.includes(resource) ? `, "namespace": "${namespace}"` : ''}}`;
        if (namespacedResources.includes(resource)) {
          errorMessage += `\n• List across all namespaces: {"resource": "${resource}s", "allNamespaces": true}`;
        }
        throw new Error(errorMessage);
      }

      logger.info(`Describing ${resource}: ${name}`, { resource, name, namespace, cluster });

      // Build kubectl describe command
      let args = ['describe', resource, name];

      // Only namespaced resources need namespace specification
      if (namespacedResources.includes(resource)) {
        args.push('-n', namespace);
      }

      logger.info(`Executing kubectl describe with args:`, args);

      // Execute kubectl describe with cluster support
      const output = await kubectl.execute(args, cluster);

      logger.info(`kubectl describe completed, output length: ${output ? output.length : 0}`);

      // Format output with error handling
      let formattedOutput;
      try {
        formattedOutput = this.formatDescribeOutput(resource, name, namespace, output);
        logger.info(`Output formatting completed, formatted length: ${formattedOutput ? formattedOutput.length : 0}`);
      } catch (formatError) {
        logger.error(`Error formatting output:`, formatError);
        // Fallback to raw output if formatting fails
        formattedOutput = `${resource.toUpperCase()} Details: ${name}\n${'='.repeat(30)}\n\n${output || 'No output received'}`;
      }

      return {
        content: [{
          type: "text",
          text: formattedOutput
        }]
      };

    } catch (error) {
      logger.error(`kubectl describe failed: ${resource}/${name}`, error);

      // If it is a prerequisite error, rethrow it directly for the MCP handler to process
      if (error.name === 'PrerequisiteError') {
        throw error;
      }

      // Handle common errors
      let errorMessage = error.message || 'Unknown error';

      if (!errorMessage.includes('not found')) {  // Skip if already handled by existence check
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('Forbidden')) {
          errorMessage = `Insufficient permissions to describe ${resource} '${name}'`;
          if (namespacedResources.includes(resource)) {
            errorMessage += ` in namespace "${namespace}"`;
          }
          errorMessage += '\nPlease verify your RBAC permissions.';
        } else if (errorMessage.includes('connection refused')) {
          errorMessage = 'Unable to connect to Kubernetes cluster. Please verify:';
          errorMessage += '\n1. The cluster is running and accessible';
          errorMessage += '\n2. Your kubeconfig is correctly configured';
          if (cluster) {
            errorMessage += `\n3. The cluster ID "${cluster}" is correct`;
          }
        }
      }

      return {
        content: [{
          type: "text",
          text: errorMessage
        }],
        isError: true
      };
    }
  }

  /**
   * Format describe output with robust error handling
   */
  formatDescribeOutput(resource, name, namespace, rawOutput) {
    try {
      // Input validation
      if (!rawOutput || typeof rawOutput !== 'string') {
        logger.warn('Invalid rawOutput received:', typeof rawOutput);
        return `${resource.toUpperCase()} Details: ${name}\n${'='.repeat(30)}\n\nNo output received from kubectl describe`;
      }

      const namespacedResources = ['pod', 'service', 'deployment', 'configmap', 'secret', 'serviceaccount'];

      let header = `${resource.toUpperCase()} Details: ${name}`;

      if (namespacedResources.includes(resource)) {
        header += ` (namespace: ${namespace})`;
      }

      let output = header + '\n';
      output += '='.repeat(header.length) + '\n\n';

      // Parse and format output with safety checks
      const lines = rawOutput.split('\n');
      let inEventsSection = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] || '';
        const trimmedLine = line.trim();

        // Skip empty lines
        if (!trimmedLine) {
          output += '\n';
          continue;
        }

        // Detect main sections - more robust detection
        if (trimmedLine.includes(':') && !trimmedLine.startsWith(' ') && !trimmedLine.includes('  ')) {
          if (trimmedLine.toLowerCase().includes('events')) {
            inEventsSection = true;
            output += '**Event Log:**\n';
            output += '```\n';
          } else if (trimmedLine.toLowerCase().includes('conditions')) {
            inEventsSection = false;
            output += '**Status Conditions:**\n';
          } else if (trimmedLine.toLowerCase().includes('labels')) {
            inEventsSection = false;
            output += '**Labels:**\n';
          } else if (trimmedLine.toLowerCase().includes('annotations')) {
            inEventsSection = false;
            output += '**Annotations:**\n';
          } else {
            // Other section headers
            inEventsSection = false;
            output += `**${trimmedLine}**\n`;
          }
        } else {
          // Content lines
          if (inEventsSection) {
            output += line + '\n';
          } else {
            // Indented content
            output += `  ${trimmedLine}\n`;
          }
        }
      }

      // If in events section, close code block
      if (inEventsSection) {
        output += '```\n';
      }

      output += '\n**Tip**: Use `kubectl_logs` to view Pod logs, use `kubectl_get` to view resource lists\n';

      return output;

    } catch (error) {
      logger.error('Error in formatDescribeOutput:', error);
      // Return safe fallback
      return `${resource.toUpperCase()} Details: ${name}\n${'='.repeat(30)}\n\n${rawOutput || 'Error formatting output'}`;
    }
  }

  /**
   * Get resource icon
   */
  getResourceIcon(resource) {
    // Remove all icons, return empty string
    return '';
  }
}
