import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';

export class KubectlLogsTool extends BaseTool {
  constructor() {
    super('kubectl_logs', 'Get Pod logs');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          pod: {
            type: 'string',
            description: 'Pod name (required)',
          },
          namespace: {
            type: 'string',
            description: 'Namespace (defaults to default)',
            default: 'default',
          },
          container: {
            type: 'string',
            description: 'Container name (required for multi-container Pods)',
          },
          lines: {
            type: 'integer',
            description: 'Show last N lines of logs (default 100, max 1000)',
            minimum: 1,
            maximum: 1000,
            default: 100,
          },
          since: {
            type: 'string',
            description: 'Show logs after specified time (e.g.: 1h, 30m, 10s)',
          },
          follow: {
            type: 'boolean',
            description: 'Whether to continuously follow logs (default false, disabled for security)',
            default: false,
          },
          previous: {
            type: 'boolean',
            description: 'Whether to show logs from previous container instance (default false)',
            default: false,
          },
        },
        required: ['pod'],
      },
    };
  }

  async execute(args) {
    try {
      this.validateInput(args);

      const {
        pod,
        namespace = 'default',
        container,
        lines = 100,
        since,
        follow = false,
        previous = false
      } = args;

      // Security restriction: don't allow follow mode to avoid long-running processes
      if (follow) {
        throw new Error('Follow mode is disabled for security reasons');
      }

      // Limit lines
      const maxLines = Math.min(Math.max(1, lines), 1000);

      // Build kubectl logs command
      const kubectlArgs = ['logs', pod];

      // Add namespace
      if (namespace && namespace !== 'default') {
        kubectlArgs.push('-n', namespace);
      }

      // Add container name
      if (container) {
        kubectlArgs.push('-c', container);
      }

      // Add line limit
      kubectlArgs.push('--tail', maxLines.toString());

      // Add time limit
      if (since) {
        // Validate time format (simple validation)
        if (!/^\d+[smhd]$/.test(since)) {
          throw new Error('Invalid time format, should be number with unit (s/m/h/d), e.g.: 30m, 1h, 2d');
        }
        kubectlArgs.push('--since', since);
      }

      // Add previous option
      if (previous) {
        kubectlArgs.push('--previous');
      }

      // Execute command
      const result = await kubectl.execute(kubectlArgs);

      // Format response
      const logInfo = {
        pod: pod,
        namespace: namespace,
        container: container || '(default)',
        lines: maxLines,
        since: since || '(all)',
        previous: previous,
        logLength: result.length,
        logs: result
      };

      this.logSuccess(args, { content: [{ text: result }] });

      // Return structured response
      return {
        content: [
          {
            type: 'text',
            text: `Pod: ${pod} (namespace: ${namespace})${container ? `, container: ${container}` : ''}
Lines: ${maxLines}${since ? `, time range: ${since}` : ''}${previous ? ', previous instance' : ''}
Log length: ${result.length} characters

=== Log Content ===
${result}`,
          },
        ],
      };

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(error.message);
    }
  }
}