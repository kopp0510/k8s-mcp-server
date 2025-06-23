/**
 * Helm Repo List 工具
 * 列出已添加的 Helm repositories
 */

import { BaseTool } from './base-tool.js';
import { helm } from '../utils/helm.js';

export class HelmRepoListTool extends BaseTool {
  constructor() {
    super('helm_repo_list', '列出已添加的 Helm chart repositories');
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
            description: '輸出格式',
            enum: ['table', 'json', 'yaml'],
            default: 'table'
          }
        },
        required: []
      }
    };
  }

  async execute(args) {
    try {
      this.validateInput(args);

      const { output = 'table' } = args;

      // 建構 helm repo list 指令
      const command = this.buildHelmRepoListCommand(output);

      // 執行指令
      const result = await helm.execute(command);

      // 格式化輸出
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

      result += `找到 ${repos.length} 個 repository:\n\n`;

      // 表格輸出
      result += `${header}\n`;
      result += `${'='.repeat(header.length)}\n`;

      repos.forEach(repo => {
        result += `${repo}\n`;
      });

      result += `\n說明：\n`;
      result += `• NAME: Repository 名稱\n`;
      result += `• URL: Repository 的 URL 位址\n\n`;

    } else {
      // JSON/YAML 格式直接輸出
      result += `**Repository 資料 (${format.toUpperCase()} 格式):**\n\n`;
      result += `\`\`\`${format}\n`;
      result += output;
      result += `\n\`\`\`\n\n`;
    }

    result += `**相關操作提示:**\n`;
    result += `• 使用 helm_repo_add 添加新的 repository\n`;
    result += `• 使用 helm_repo_update 更新 repository 索引\n`;
    result += `• 使用 helm_search_repo 在 repositories 中搜尋 charts\n`;
    result += `• 使用 helm_repo_remove 移除不需要的 repository\n`;

    return result;
  }

  formatEmptyResult() {
    let result = `Helm Chart Repositories\n`;
    result += `==================================================\n\n`;

    result += `沒有找到任何 Helm repository。\n\n`;

    result += `**開始使用 Helm Repositories:**\n\n`;
    result += `1. **添加官方 stable repository:**\n`;
    result += `   helm repo add stable https://charts.helm.sh/stable\n\n`;

    result += `2. **添加 Bitnami repository:**\n`;
    result += `   helm repo add bitnami https://charts.bitnami.com/bitnami\n\n`;

    result += `3. **更新 repository 索引:**\n`;
    result += `   helm repo update\n\n`;

    result += `4. **搜尋可用的 charts:**\n`;
    result += `   helm search repo nginx\n\n`;

    result += `**常用 Public Repositories:**\n`;
    result += `• Bitnami: https://charts.bitnami.com/bitnami\n`;
    result += `• Helm Stable: https://charts.helm.sh/stable\n`;
    result += `• Ingress NGINX: https://kubernetes.github.io/ingress-nginx\n`;
    result += `• Prometheus Community: https://prometheus-community.github.io/helm-charts\n`;
    result += `• Grafana: https://grafana.github.io/helm-charts\n\n`;

    result += `**提示:**\n`;
    result += `• 使用 helm_repo_add 添加 repository\n`;
    result += `• 使用 helm_search_hub 搜尋 Artifact Hub 上的 charts\n`;

    return result;
  }

  formatErrorMessage(errorMessage) {
    if (errorMessage.includes('no repositories')) {
      return this.formatEmptyResult();
    }

    let result = `取得 Helm repositories 時發生錯誤。\n\n`;
    result += `錯誤訊息: ${errorMessage}\n\n`;

    result += `可能的原因：\n`;
    result += `• Helm 未正確安裝\n`;
    result += `• Helm 配置檔案損壞\n`;
    result += `• 權限不足\n\n`;

    result += `建議操作：\n`;
    result += `• 檢查 Helm 安裝: helm version\n`;
    result += `• 重新初始化 Helm 配置\n`;
    result += `• 檢查檔案權限\n`;

    return result;
  }
}