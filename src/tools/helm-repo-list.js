/**
 * Helm Repo List Tool
 * List added Helm repositories
 */

import { BaseTool } from './base-tool.js';
import { helm } from '../utils/helm.js';
import { validator } from '../utils/validator.js';

export class HelmRepoListTool extends BaseTool {
  constructor() {
    super('helm_repo_list', 'List added Helm chart repositories');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          output: {
            type: 'string',
            description: 'Output format',
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
        required: []
      }
    };
  }

  async execute(args) {
    try {
      validator.validateInput(args, this.getDefinition().inputSchema);

      const { output = 'table', cluster } = args;

      // 驗證叢集參數
      if (cluster) {
        validator.validateClusterId(cluster);
      }

      // Build helm repo list command
      const command = this.buildHelmRepoListCommand(output);

      // Execute command with cluster support
      const result = await helm.execute(command, cluster);

      // Format output
      const formattedOutput = this.formatRepoListOutput(result, output);

      this.logSuccess(args, { content: [{ text: formattedOutput }] });
      return this.createResponse(formattedOutput);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(this.formatErrorMessage(error.message));
    }
  }

  buildHelmRepoListCommand(output) {
    let command = ['repo', 'list'];

    if (output !== 'table') {
      command.push('--output', output);
    }

    return command;
  }

  formatRepoListOutput(output, format) {
    if (!output.trim()) {
      return this.formatEmptyResult();
    }

    let result = `Helm Chart Repositories\n`;
    result += `==================================================\n\n`;

    if (format === 'table') {
      const lines = output.trim().split('\n');
      const header = lines[0];
      const repos = lines.slice(1);

      result += `Found ${repos.length} repositories:\n\n`;

      // Table output
      result += `${header}\n`;
      result += `${'='.repeat(header.length)}\n`;

      repos.forEach(repo => {
        result += `${repo}\n`;
      });

      result += `\nExplanation:\n`;
      result += `• NAME: Repository name\n`;
      result += `• URL: Repository URL address\n\n`;

    } else {
      // JSON/YAML format direct output
      result += `**Repository data (${format.toUpperCase()} format):**\n\n`;
      result += `\`\`\`${format}\n`;
      result += output;
      result += `\n\`\`\`\n\n`;
    }

    result += `**Related Operation Tips:**\n`;
    result += `• Use helm_repo_add to add new repository\n`;
    result += `• Use helm_repo_update to update repository index\n`;
    result += `• Use helm_search_repo to search charts in repositories\n`;
    result += `• Use helm_repo_remove to remove unnecessary repository\n`;

    return result;
  }

  formatEmptyResult() {
    let result = `Helm Chart Repositories\n`;
    result += `==================================================\n\n`;

    result += `No Helm repository found.\n\n`;

    result += `**Getting Started with Helm Repositories:**\n\n`;
    result += `1. **Add official stable repository:**\n`;
    result += `   helm repo add stable https://charts.helm.sh/stable\n\n`;

    result += `2. **Add Bitnami repository:**\n`;
    result += `   helm repo add bitnami https://charts.bitnami.com/bitnami\n\n`;

    result += `3. **Update repository index:**\n`;
    result += `   helm repo update\n\n`;

    result += `4. **Search available charts:**\n`;
    result += `   helm search repo nginx\n\n`;

    result += `**Common Public Repositories:**\n`;
    result += `• Bitnami: https://charts.bitnami.com/bitnami\n`;
    result += `• Helm Stable: https://charts.helm.sh/stable\n`;
    result += `• Ingress NGINX: https://kubernetes.github.io/ingress-nginx\n`;
    result += `• Prometheus Community: https://prometheus-community.github.io/helm-charts\n`;
    result += `• Grafana: https://grafana.github.io/helm-charts\n\n`;

    result += `**Tips:**\n`;
    result += `• Use helm_repo_add to add repository\n`;
    result += `• Use helm_search_hub to search charts on Artifact Hub\n`;

    return result;
  }

  formatErrorMessage(errorMessage) {
    if (errorMessage.includes('no repositories')) {
      return this.formatEmptyResult();
    }

    let result = `Error occurred while getting Helm repositories.\n\n`;
    result += `Error message: ${errorMessage}\n\n`;

    result += `Possible reasons:\n`;
    result += `• Helm is not correctly installed\n`;
    result += `• Helm configuration file is corrupted\n`;
    result += `• Insufficient permissions\n\n`;

    result += `Suggested actions:\n`;
    result += `• Check Helm installation: helm version\n`;
    result += `• Re-initialize Helm configuration\n`;
    result += `• Check file permissions\n`;

    return result;
  }
}