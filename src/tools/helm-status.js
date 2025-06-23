/**
 * Helm Status 工具
 * 查看 Helm release 的詳細狀態
 */

import { BaseTool } from './base-tool.js';
import { helm } from '../utils/helm.js';

export class HelmStatusTool extends BaseTool {
  constructor() {
    super('helm_status', '查看 Helm release 的詳細狀態資訊');
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
            description: 'Helm release 名稱'
          },
          namespace: {
            type: 'string',
            description: 'Kubernetes 命名空間（可選）'
          },
          revision: {
            type: 'integer',
            description: '指定修訂版本號（可選，預設為最新版本）',
            minimum: 1
          },
          showResources: {
            type: 'boolean',
            description: '顯示相關的 Kubernetes 資源（預設：false）',
            default: false
          },
          showHooks: {
            type: 'boolean',
            description: '顯示 Helm hooks（預設：false）',
            default: false
          }
        },
        required: ['releaseName']
      }
    };
  }

  async execute(args) {
    try {
      this.validateInput(args);

      const {
        releaseName,
        namespace,
        revision,
        showResources = false,
        showHooks = false
      } = args;

      // 建構 helm status 指令
      const command = this.buildHelmStatusCommand({
        releaseName,
        namespace,
        revision,
        showResources,
        showHooks
      });

      // 執行指令
      const output = await helm.execute(command);

      // 格式化輸出
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

    // 命名空間參數
    if (namespace) {
      command.push('--namespace', namespace);
    }

    // 修訂版本
    if (revision) {
      command.push('--revision', revision.toString());
    }

    // 顯示資源
    if (showResources) {
      command.push('--show-resources');
    }

    // 顯示 hooks
    if (showHooks) {
      command.push('--show-hooks');
    }

    return command;
  }

  formatStatusOutput(output, args) {
    const { releaseName, namespace, revision } = args;

    let result = `Helm Release 狀態\n`;
    result += `==================================================\n\n`;

    result += `**Release 資訊:**\n`;
    result += `• 名稱: ${releaseName}\n`;
    if (namespace) {
      result += `• 命名空間: ${namespace}\n`;
    }
    if (revision) {
      result += `• 指定修訂版本: ${revision}\n`;
    }
    result += `\n`;

    // 添加原始輸出
    result += `**詳細狀態:**\n`;
    result += `${output}\n`;

    result += `**相關操作提示:**\n`;
    result += `• 使用 helm_list 查看所有 releases\n`;
    result += `• 使用 helm_get_values 查看配置值\n`;
    result += `• 使用 helm_history 查看修訂歷史\n`;
    result += `• 使用 helm_get_manifest 查看生成的 Kubernetes 資源\n`;

    return result;
  }

  formatErrorMessage(errorMessage, args) {
    const { releaseName, namespace } = args;

    if (errorMessage.includes('not found')) {
      let result = `Release "${releaseName}" 不存在。\n\n`;

      if (namespace) {
        result += `在命名空間 "${namespace}" 中找不到該 release。\n\n`;
      }

      result += `可能的原因：\n`;
      result += `• Release 名稱拼寫錯誤\n`;
      result += `• Release 在不同的命名空間中\n`;
      result += `• Release 已被卸載\n\n`;

      result += `建議操作：\n`;
      result += `• 使用 helm_list 查看所有可用的 releases\n`;
      result += `• 使用 helm_list 並設定 allNamespaces=true 跨命名空間搜尋\n`;
      result += `• 檢查 release 名稱是否正確\n`;

      return result;
    }

    return errorMessage;
  }
}