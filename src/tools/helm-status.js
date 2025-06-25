/**
 * Helm Status Tool
 * View detailed status of Helm release
 */

import { BaseTool } from './base-tool.js';
import { helm } from '../utils/helm.js';
import { validator } from '../utils/validator.js';

export class HelmStatusTool extends BaseTool {
  constructor() {
    super('helm_status', 'View detailed status information of Helm release');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          releaseName: {
            type: 'string',
            description: 'Helm release name'
          },
          namespace: {
            type: 'string',
            description: 'Kubernetes namespace (optional)'
          },
          revision: {
            type: 'integer',
            description: 'Specify revision number (optional, defaults to latest version)',
            minimum: 1
          },
          showResources: {
            type: 'boolean',
            description: 'Show related Kubernetes resources (default: false)',
            default: false
          },
          showHooks: {
            type: 'boolean',
            description: 'Show Helm hooks (default: false)',
            default: false
          }
        },
        required: ['releaseName']
      }
    };
  }

  async execute(args) {
    try {
      validator.validateInput(args, this.getDefinition().inputSchema);

      const {
        releaseName,
        namespace,
        revision,
        showResources = false,
        showHooks = false
      } = args;

      // Build helm status command
      const command = this.buildHelmStatusCommand({
        releaseName,
        namespace,
        revision,
        showResources,
        showHooks
      });

      // Execute command
      const output = await helm.execute(command);

      // Format output
      const formattedOutput = this.formatStatusOutput(output, args);

      this.logSuccess(args, { content: [{ text: formattedOutput }] });
      return this.createResponse(formattedOutput);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(this.formatErrorMessage(error.message, args));
    }
  }

  buildHelmStatusCommand(options) {
    const {
      releaseName,
      namespace,
      revision,
      showResources,
      showHooks
    } = options;

    let command = ['status', releaseName];

    // Namespace parameter
    if (namespace) {
      command.push('--namespace', namespace);
    }

    // Revision
    if (revision) {
      command.push('--revision', revision.toString());
    }

    // Show resources
    if (showResources) {
      command.push('--show-resources');
    }

    // Show hooks
    if (showHooks) {
      command.push('--show-hooks');
    }

    return command;
  }

  formatStatusOutput(output, args) {
    const { releaseName, namespace, revision } = args;

    let result = `Helm Release Status\n`;
    result += `==================================================\n\n`;

    result += `**Release Information:**\n`;
    result += `• Name: ${releaseName}\n`;
    if (namespace) {
      result += `• Namespace: ${namespace}\n`;
    }
    if (revision) {
      result += `• Specified revision: ${revision}\n`;
    }
    result += `\n`;

    // Add original output
    result += `**Detailed Status:**\n`;
    result += `${output}\n`;

    result += `**Related Operation Tips:**\n`;
    result += `• Use helm_list to view all releases\n`;
    result += `• Use helm_get_values to view configuration values\n`;
    result += `• Use helm_history to view revision history\n`;
    result += `• Use helm_get_manifest to view generated Kubernetes resources\n`;

    return result;
  }

  formatErrorMessage(errorMessage, args) {
    const { releaseName, namespace } = args;

    if (errorMessage.includes('not found')) {
      let result = `Release "${releaseName}" does not exist.\n\n`;

      if (namespace) {
        result += `Cannot find this release in namespace "${namespace}".\n\n`;
      }

      result += `Possible reasons:\n`;
      result += `• Release name is misspelled\n`;
      result += `• Release is in a different namespace\n`;
      result += `• Release has been uninstalled\n\n`;

      result += `Suggested actions:\n`;
      result += `• Use helm_list to view all available releases\n`;
      result += `• Use helm_list and set allNamespaces=true to search across namespaces\n`;
      result += `• Check if the release name is correct\n`;

      return result;
    }

    return errorMessage;
  }
}