/**
 * Helm List Tool
 * List Helm releases
 */

import { BaseTool } from './base-tool.js';
import { helm } from '../utils/helm.js';
import { logger } from '../utils/logger.js';

export class HelmListTool extends BaseTool {
  constructor() {
    super('helm_list', 'List Helm releases with various filtering options (including -A parameter)');
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
            description: 'Kubernetes namespace (optional, defaults to all namespaces)'
          },
          allNamespaces: {
            type: 'boolean',
            description: 'Show releases across all namespaces, equivalent to helm ls -A (default: true)',
            default: true
          },
          status: {
            type: 'string',
            description: 'Filter releases by status (optional): all=all status, deployed=deployed (default), failed=failed, uninstalled=uninstalled, superseded=superseded, pending=pending',
            enum: ['all', 'deployed', 'failed', 'uninstalled', 'superseded', 'pending']
          },
          filter: {
            type: 'string',
            description: 'Release name filter (supports regular expressions)'
          },
          short: {
            type: 'boolean',
            description: 'Use short output format (default: false)',
            default: false
          },
          date: {
            type: 'boolean',
            description: 'Include last deployment time (default: true)',
            default: true
          },
          reverse: {
            type: 'boolean',
            description: 'Reverse sort results (default: false)',
            default: false
          },
          max: {
            type: 'integer',
            description: 'Maximum number of results (default: 256)',
            minimum: 1,
            maximum: 1000,
            default: 256
          }
        },
        required: []
      }
    };
  }

  async execute(args) {
    try {
      this.validateInput(args);

      const {
        namespace,
        allNamespaces = true,
        status,
        filter,
        short = false,
        date = true,
        reverse = false,
        max = 256
      } = args;

      // Validate parameter combination - only check conflicts when allNamespaces is explicitly set
      if (namespace && args.allNamespaces === true) {
        throw new Error('namespace and allNamespaces parameters cannot be used together');
      }

      // If namespace is specified, don't use allNamespaces
      const effectiveAllNamespaces = namespace ? false : allNamespaces;

      // Build helm list command
      const commandOptions = {
        namespace,
        allNamespaces: effectiveAllNamespaces,
        status,
        filter,
        short,
        date,
        reverse,
        max
      };

      const command = this.buildHelmListCommand(commandOptions);

      // Log debug information
      logger.debug(`HelmListTool execution parameters:`, {
        originalParameters: args,
        processedParameters: commandOptions,
        finalCommand: `helm ${command.join(' ')}`
      });

      // Execute command
      const output = await helm.execute(command);

      // Format output
      const formattedOutput = this.formatListOutput(output, {
        ...args,
        allNamespaces: effectiveAllNamespaces
      });

      this.logSuccess(args, { content: [{ text: formattedOutput }] });
      return this.createResponse(formattedOutput);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(error.message);
    }
  }

  buildHelmListCommand(options) {
    const {
      namespace,
      allNamespaces,
      status,
      filter,
      short,
      date,
      reverse,
      max
    } = options;

    let command = ['list'];

    // Namespace parameter handling
    if (namespace) {
      // Specify specific namespace
      command.push('--namespace', namespace);
    } else if (allNamespaces === false) {
      // Explicitly set not to use all namespaces, use current namespace
      // Don't add any namespace parameters
    } else {
      // Default or explicitly set to use all namespaces
      command.push('-A');
    }

    // Status filtering - handle according to helm's actual parameters
    if (status && status.trim() !== '') {
      switch (status.toLowerCase()) {
        case 'all':
          command.push('--all');
          break;
        case 'failed':
          command.push('--failed');
          break;
        case 'uninstalled':
          command.push('--uninstalled');
          break;
        case 'superseded':
          command.push('--superseded');
          break;
        case 'pending':
          command.push('--pending');
          break;
        case 'deployed':
        default:
          // deployed is the default status, no additional parameters needed
          break;
      }
    }

    // Name filtering
    if (filter) {
      command.push(filter);
    }

    // Output format
    if (short) {
      command.push('--short');
    }

    // Time display
    if (date) {
      command.push('--date');
    }

    // Sorting
    if (reverse) {
      command.push('--reverse');
    }

    // Maximum results
    command.push('--max', max.toString());

    return command;
  }

  formatListOutput(output, args) {
    // Log original output for debugging
    logger.debug(`Helm original output length: ${output.length}`);
    logger.debug(`Helm original output first 500 characters: ${JSON.stringify(output.substring(0, 500))}`);

    if (!output.trim()) {
      logger.debug('Helm output is empty');
      return this.formatEmptyResult(args);
    }

    const lines = output.trim().split('\n');
    logger.debug(`Helm output total line count: ${lines.length}`);

    // Find actual data lines (lines containing tabs are usually data lines)
    const dataLines = [];
    let headerProcessed = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      logger.debug(`Line ${i}: "${line.substring(0, 100)}${line.length > 100 ? '...' : ''}"`);

      // Skip empty lines
      if (!line) {
        continue;
      }

      // Check if it's a data line (contains tabs and is not pure title)
      if (line.includes('\t')) {
        // If this line contains a typical helm release field pattern
        // The second field should be the namespace, the third is the revision number, and the fifth is the status
        const fields = line.split('\t');
        if (fields.length >= 4) {
          if (fields[1] && fields[2] && fields[4] &&
              (fields[4].includes('deployed') || fields[4].includes('failed') ||
               fields[4].includes('pending') || fields[4].includes('superseded'))) {
            dataLines.push(line);
            headerProcessed = true;
          }
        }
      }
    }

    logger.debug(`Found data line count: ${dataLines.length}`);

    if (dataLines.length === 0) {
      logger.debug('No valid release data lines found');
      return this.formatEmptyResult(args);
    }

    let result = `Helm Releases List\n`;
    result += `==================================================\n\n`;

    // Executed command information
    if (args.allNamespaces !== false && !args.namespace) {
      result += `Query range: All namespaces (using -A parameter)\n`;
    } else if (args.namespace) {
      result += `Query range: Namespace "${args.namespace}"\n`;
    } else {
      result += `Query range: Current namespace\n`;
    }

    // Filter information
    if (args.status && args.status.trim() !== '') {
      result += `Status filtering: Only show releases in "${args.status}" status\n`;
    }
    if (args.filter && args.filter.trim() !== '') {
      result += `Name filtering: ${args.filter}\n`;
    }

    // Statistics information
    result += `Found ${dataLines.length} Helm releases`;
    if (args.status && args.status.trim() !== '') {
      result += ` (only ${args.status} status)`;
    }
    result += `:\n\n`;

    // Table title
    result += `${'NAME'.padEnd(20)} ${'NAMESPACE'.padEnd(15)} ${'REVISION'.padEnd(8)} ${'STATUS'.padEnd(12)} ${'CHART'.padEnd(30)} APP VERSION\n`;
    result += `${'='.repeat(100)}\n`;

    // Format each release
    dataLines.forEach(line => {
      const fields = line.split('\t').map(f => f.trim());
      if (fields.length >= 6) {
        const [name, namespace, revision, updated, status, chart, appVersion] = fields;
        result += `${name.padEnd(20)} ${namespace.padEnd(15)} ${revision.padEnd(8)} ${status.padEnd(12)} ${chart.padEnd(30)} ${appVersion || 'N/A'}\n`;
      } else {
        // If field is insufficient, directly display the original line
        result += `${line}\n`;
      }
    });

    // Add additional information
    result += `\nNotes:\n`;
    result += `• NAME: Release name\n`;
    result += `• NAMESPACE: Deployed namespace\n`;
    result += `• REVISION: Revision number\n`;
    result += `• STATUS: Deployment status\n`;
    result += `• CHART: Used Chart name and version\n`;
    result += `• APP VERSION: Application version\n\n`;

    result += `Tips:\n`;
    result += `• Use helm_status to view release detailed status\n`;
    result += `• Use helm_get_values to view release configuration values\n`;
    result += `• Use helm_history to view release history\n`;

    return result;
  }

  formatEmptyResult(args) {
    let result = `Helm Releases List\n`;
    result += `==================================================\n\n`;

    if (args.namespace) {
      result += `No Helm release found in namespace "${args.namespace}".\n\n`;
      result += `Possible reasons:\n`;
      result += `• There is actually no deployed Helm releases in the namespace\n`;
      result += `• Namespace "${args.namespace}" does not exist\n`;
      result += `• No permission to access this namespace\n\n`;
    } else if (args.allNamespaces !== false) {
      result += `Using -A parameter to view all namespaces, but no`;
      if (args.status && args.status.trim() !== '') {
        result += ` releases in "${args.status}" status`;
      }
      result += ` Helm release found.\n\n`;
      result += `Possible reasons:\n`;
      if (args.status && args.status.trim() !== '') {
        result += `• No releases in "${args.status}" status (try removing status parameter to view all status)\n`;
      }
      result += `• There is actually no deployed Helm releases in the entire cluster\n`;
      result += `• No permission to view releases across namespaces (requires cluster-wide permission)\n`;
      result += `• kubeconfig configuration problem\n\n`;
    } else {
      result += `No`;
      if (args.status && args.status.trim() !== '') {
        result += ` releases in "${args.status}" status`;
      }
      result += ` Helm release found in the current namespace.\n\n`;
    }

    result += `Troubleshooting:\n`;
    result += `• Check kubeconfig configuration: kubectl config current-context\n`;
    result += `• Confirm accessible namespaces: kubectl get namespaces\n`;
    result += `• Test native helm command: helm ls -A\n`;
    result += `• Ensure Helm is correctly installed and configured\n`;
    result += `• Use helm_repo_list to view added Chart repositories\n`;

    return result;
  }
}