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
          }
        },
        required: ['resource', 'name']
      }
    };
  }

  async execute({ resource, name, namespace = 'default' }) {
    // Define namespaced resource types (moved to top of function to avoid scope issues)
    const namespacedResources = ['pod', 'service', 'deployment', 'configmap', 'secret', 'serviceaccount'];

    try {
      // Validate input
      validator.validateInput({ resource, name, namespace });

      // Validate resource name
      validator.validateResourceName(name);

      // For namespaced resources, validate namespace
      if (namespacedResources.includes(resource)) {
        validator.validateNamespace(namespace);
      }

      logger.info(`Describing ${resource}: ${name}`, { resource, name, namespace });

      // Build kubectl describe command
      let args = ['describe', resource, name];

      // Only namespaced resources need namespace specification
      if (namespacedResources.includes(resource)) {
        args.push('-n', namespace);
      }

      // Execute kubectl describe
      const output = await kubectl.execute(args);

      // Format output
      const formattedOutput = this.formatDescribeOutput(resource, name, namespace, output);

      return {
        content: [{
          type: "text",
          text: formattedOutput
        }]
      };

    } catch (error) {
      logger.error(`kubectl describe failed: ${resource}/${name}`, error);

      // Handle common errors
      let errorMessage = error.message || 'Unknown error';

      if (errorMessage.includes('not found')) {
        errorMessage = `Cannot find ${resource} '${name}'`;
        if (namespacedResources.includes(resource)) {
          errorMessage += ` (namespace: ${namespace})`;
        }
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('Forbidden')) {
        errorMessage = `Insufficient permissions to describe ${resource} '${name}'`;
      } else if (errorMessage.includes('connection refused')) {
        errorMessage = 'Unable to connect to Kubernetes cluster';
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
   * Format describe output
   */
  formatDescribeOutput(resource, name, namespace, rawOutput) {
    const namespacedResources = ['pod', 'service', 'deployment', 'configmap', 'secret', 'serviceaccount'];

    let header = `${resource.toUpperCase()} Details: ${name}`;

    if (namespacedResources.includes(resource)) {
      header += ` (namespace: ${namespace})`;
    }

    let output = header + '\n';
    output += '='.repeat(header.length) + '\n\n';

    // Parse and format output
    const lines = rawOutput.split('\n');
    let currentSection = '';
    let inEventsSection = false;

    for (let line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) {
        output += '\n';
        continue;
      }

      // Detect main sections
      if (trimmedLine.includes(':') && !trimmedLine.startsWith(' ') && !trimmedLine.includes('  ')) {
        if (trimmedLine.toLowerCase().includes('events')) {
          inEventsSection = true;
          output += '**Event Log:**\n';
          output += '```\n';
        } else if (trimmedLine.toLowerCase().includes('conditions')) {
          output += '**Status Conditions:**\n';
        } else if (trimmedLine.toLowerCase().includes('labels')) {
          output += '**Labels:**\n';
        } else if (trimmedLine.toLowerCase().includes('annotations')) {
          output += '**Annotations:**\n';
        } else {
          // Other section headers
          currentSection = trimmedLine;
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
  }

  /**
   * Get resource icon
   */
  getResourceIcon(resource) {
    // Remove all icons, return empty string
    return '';
  }
}