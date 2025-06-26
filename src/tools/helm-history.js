/**
 * Helm History Tool
 * View deployment history of Helm release
 */

import { BaseTool } from './base-tool.js';
import { helm } from '../utils/helm.js';
import { logger } from '../utils/logger.js';
import { validator } from '../utils/validator.js';

export class HelmHistoryTool extends BaseTool {
  constructor() {
    super('helm_history', 'View deployment history of Helm release');
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
            description: 'Helm release name (required)'
          },
          namespace: {
            type: 'string',
            description: 'Kubernetes namespace (optional)'
          },
          max: {
            type: 'integer',
            description: 'Maximum number of history records to display (default: 256)',
            minimum: 1,
            maximum: 1000,
            default: 256
          },
          output: {
            type: 'string',
            description: 'Output format (default: table)',
            enum: ['table', 'json', 'yaml'],
            default: 'table'
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
        max = 256,
        output = 'table',
        cluster
      } = args;

      // 驗證叢集參數
      if (cluster) {
        validator.validateClusterId(cluster);
      }

      // Validate release name
      if (!releaseName || releaseName.trim() === '') {
        throw new Error('releaseName parameter cannot be empty');
      }

      // Build helm history command
      const command = this.buildHelmHistoryCommand({
        releaseName: releaseName.trim(),
        namespace,
        max,
        output
      });

      // Log debug information
      logger.debug(`HelmHistoryTool execution parameters:`, {
        originalParameters: args,
        finalCommand: `helm ${command.join(' ')}`
      });

      // Execute command with cluster support
      const helmOutput = await helm.execute(command, cluster);

      // Format output
      const formattedOutput = this.formatHistoryOutput(helmOutput, args);

      this.logSuccess(args, { content: [{ text: formattedOutput }] });
      return this.createResponse(formattedOutput);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(error.message);
    }
  }

  buildHelmHistoryCommand(options) {
    const { releaseName, namespace, max, output } = options;

    let command = ['history', releaseName];

    // Namespace parameter
    if (namespace && namespace.trim() !== '') {
      command.push('--namespace', namespace.trim());
    }

    // Maximum count limit
    if (max && max !== 256) {
      command.push('--max', max.toString());
    }

    // Output format
    if (output && output !== 'table') {
      command.push('--output', output);
    }

    return command;
  }

  formatHistoryOutput(output, args) {
    const { releaseName, namespace, output: outputFormat = 'table' } = args;

    if (!output || output.trim() === '') {
      return this.formatEmptyResult(args);
    }

    // If it's JSON or YAML format, return original output directly
    if (outputFormat === 'json' || outputFormat === 'yaml') {
      const header = this.buildOutputHeader(args);
      return `${header}\n\n${output}`;
    }

    // Process table format output
    return this.formatTableOutput(output, args);
  }

  formatTableOutput(output, args) {
    const { releaseName, namespace } = args;
    const lines = output.trim().split('\n');

    if (lines.length === 0) {
      return this.formatEmptyResult(args);
    }

    // Build output header
    const header = this.buildOutputHeader(args);

    // Process table content
    let formattedLines = [];
    let revisionCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === '') continue;

      // If it's a header line
      if (line.includes('REVISION') && line.includes('UPDATED')) {
        formattedLines.push('');
        formattedLines.push(`History details:`);
        formattedLines.push('='.repeat(50));
        formattedLines.push('');
        formattedLines.push(line);
        formattedLines.push('-'.repeat(line.length));
      } else if (line.match(/^\d+/)) {
        // This is a history record line
        revisionCount++;
        formattedLines.push(line);
      }
    }

    // Build final output
    let result = header;

    if (revisionCount > 0) {
      result += `\n\nFound ${revisionCount} history records:`;
      result += formattedLines.join('\n');

      result += '\n\nExplanation:';
      result += '\n• REVISION: Version number (higher numbers indicate newer versions)';
      result += '\n• UPDATED: Deployment or update time';
      result += '\n• STATUS: Deployment status (deployed=deployed, failed=failed, superseded=superseded, etc.)';
      result += '\n• CHART: Used Chart version';
      result += '\n• APP VERSION: Application version';
      result += '\n• DESCRIPTION: Deployment description or change notes';

      result += '\n\nTips:';
      result += `\n• Use helm_status to view current release detailed information`;
      result += `\n• Use helm_get_values to view configuration values for specified version`;
      result += `\n• Latest version is revision ${revisionCount}`;
    } else {
      result += '\n\n' + this.formatEmptyResult(args).split('\n').slice(2).join('\n');
    }

    return result;
  }

  buildOutputHeader(args) {
    const { releaseName, namespace, max, output } = args;

    let header = `Helm Release History`;
    header += '\n' + '='.repeat(50);
    header += '\n';
    header += `\n**Release Information:**`;
    header += `\n• Name: ${releaseName}`;

    if (namespace) {
      header += `\n• Namespace: ${namespace}`;
    } else {
      header += `\n• Namespace: (default namespace)`;
    }

    header += `\n• Maximum records: ${max}`;
    header += `\n• Output format: ${output.toUpperCase()}`;

    return header;
  }

  formatEmptyResult(args) {
    const { releaseName, namespace } = args;

    let result = this.buildOutputHeader(args);
    result += `\n\nNo history records found for release "${releaseName}".`;
    result += '\n\nPossible reasons:';
    result += `\n• Release "${releaseName}" does not exist`;
    result += '\n• Specified namespace is incorrect';
    result += '\n• No deployment history records';

    result += '\n\nSuggestions:';
    result += '\n• Use helm_list to confirm release name';
    if (namespace) {
      result += `\n• Verify namespace "${namespace}" is correct`;
    } else {
      result += '\n• Try specifying the correct namespace';
    }

    return result;
  }
}