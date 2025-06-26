/**
 * Helm Get Values Tool
 * View configuration values of Helm release
 */

import { BaseTool } from './base-tool.js';
import { helm } from '../utils/helm.js';
import { validator } from '../utils/validator.js';

export class HelmGetValuesTool extends BaseTool {
  constructor() {
    super('helm_get_values', 'View configuration values of Helm release');
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
          output: {
            type: 'string',
            description: 'Output format',
            enum: ['yaml', 'json', 'table'],
            default: 'yaml'
          },
          allValues: {
            type: 'boolean',
            description: 'Show all values including default values (default: false)',
            default: false
          },
          cluster: {
            type: 'string',
            description: '指定要操作的叢集 ID（可選，預設使用當前叢集）',
            minLength: 1,
            maxLength: 64
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
        output = 'yaml',
        allValues = false,
        cluster
      } = args;

      // 驗證叢集參數
      if (cluster) {
        validator.validateClusterId(cluster);
      }

      // Build helm get values command
      const command = this.buildHelmGetValuesCommand({
        releaseName,
        namespace,
        revision,
        output,
        allValues
      });

      // Execute command with cluster support
      const result = await helm.execute(command, cluster);

      // Format output
      const formattedOutput = this.formatValuesOutput(result, args);

      this.logSuccess(args, { content: [{ text: formattedOutput }] });
      return this.createResponse(formattedOutput);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(this.formatErrorMessage(error.message, args));
    }
  }

  buildHelmGetValuesCommand(options) {
    const {
      releaseName,
      namespace,
      revision,
      output,
      allValues
    } = options;

    let command = ['get', 'values', releaseName];

    // Namespace parameter
    if (namespace) {
      command.push('--namespace', namespace);
    }

    // Revision
    if (revision) {
      command.push('--revision', revision.toString());
    }

    // Output format
    if (output !== 'yaml') {
      command.push('--output', output);
    }

    // Show all values
    if (allValues) {
      command.push('--all');
    }

    return command;
  }

  formatValuesOutput(output, args) {
    const { releaseName, namespace, revision, output: format, allValues } = args;

    let result = `Helm Release Configuration Values\n`;
    result += `==================================================\n\n`;

    result += `**Release Information:**\n`;
    result += `• Name: ${releaseName}\n`;
    if (namespace) {
      result += `• Namespace: ${namespace}\n`;
    }
    if (revision) {
      result += `• Revision: ${revision}\n`;
    }
    result += `• Output format: ${format.toUpperCase()}\n`;
    result += `• Scope: ${allValues ? 'All values (including default values)' : 'Custom values only'}\n`;
    result += `\n`;

    if (!output.trim()) {
      result += `**Configuration values:**\n`;
      if (allValues) {
        result += `No configuration values found (including default values).\n\n`;
      } else {
        result += `No custom configuration values. This release uses Chart default values.\n\n`;
        result += `Tip: Use allValues=true parameter to view all values (including default values).\n\n`;
      }
    } else {
      result += `**Configuration values:**\n\n`;
      result += `\`\`\`${format}\n`;
      result += output;
      result += `\n\`\`\`\n\n`;
    }

    result += `**Related Operation Tips:**\n`;
    result += `• Use helm_status to view release status\n`;
    result += `• Use helm_get_manifest to view generated Kubernetes resources\n`;
    result += `• Use helm_upgrade to update release configuration\n`;
    result += `• Use helm_history to view configuration change history\n`;

    if (!allValues) {
      result += `• Use allValues=true to view all values (including default values)\n`;
    }

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

    if (errorMessage.includes('revision')) {
      let result = `Specified revision does not exist.\n\n`;
      result += `Error message: ${errorMessage}\n\n`;

      result += `Suggested actions:\n`;
      result += `• Use helm_history to view available revisions\n`;
      result += `• Don't specify revision parameter to view latest version\n`;
      result += `• Check if the revision number is correct\n`;

      return result;
    }

    return errorMessage;
  }
}