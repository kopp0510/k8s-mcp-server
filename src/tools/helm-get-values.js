/**
 * Helm Get Values 工具
 * 查看 Helm release 的配置值
 */

import { BaseTool } from './base-tool.js';
import { helm } from '../utils/helm.js';

export class HelmGetValuesTool extends BaseTool {
  constructor() {
    super('helm_get_values', '查看 Helm release 的配置值');
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
          output: {
            type: 'string',
            description: '輸出格式',
            enum: ['yaml', 'json', 'table'],
            default: 'yaml'
          },
          allValues: {
            type: 'boolean',
            description: '顯示所有值，包括預設值（預設：false）',
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
        output = 'yaml',
        allValues = false
      } = args;

      // 建構 helm get values 指令
      const command = this.buildHelmGetValuesCommand({
        releaseName,
        namespace,
        revision,
        output,
        allValues
      });

      // 執行指令
      const result = await helm.execute(command);

      // 格式化輸出
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

    // 命名空間參數
    if (namespace) {
      command.push('--namespace', namespace);
    }

    // 修訂版本
    if (revision) {
      command.push('--revision', revision.toString());
    }

    // 輸出格式
    if (output !== 'yaml') {
      command.push('--output', output);
    }

    // 顯示所有值
    if (allValues) {
      command.push('--all');
    }

    return command;
  }

  formatValuesOutput(output, args) {
    const { releaseName, namespace, revision, output: format, allValues } = args;

    let result = `Helm Release 配置值\n`;
    result += `==================================================\n\n`;

    result += `**Release 資訊:**\n`;
    result += `• 名稱: ${releaseName}\n`;
    if (namespace) {
      result += `• 命名空間: ${namespace}\n`;
    }
    if (revision) {
      result += `• 修訂版本: ${revision}\n`;
    }
    result += `• 輸出格式: ${format.toUpperCase()}\n`;
    result += `• 範圍: ${allValues ? '所有值（包括預設值）' : '僅自定義值'}\n`;
    result += `\n`;

    if (!output.trim()) {
      result += `**配置值:**\n`;
      if (allValues) {
        result += `沒有找到任何配置值（包括預設值）。\n\n`;
      } else {
        result += `沒有自定義配置值。此 release 使用 Chart 的預設值。\n\n`;
        result += `提示: 使用 allValues=true 參數查看所有值（包括預設值）。\n\n`;
      }
    } else {
      result += `**配置值:**\n\n`;
      result += `\`\`\`${format}\n`;
      result += output;
      result += `\n\`\`\`\n\n`;
    }

    result += `**相關操作提示:**\n`;
    result += `• 使用 helm_status 查看 release 狀態\n`;
    result += `• 使用 helm_get_manifest 查看生成的 Kubernetes 資源\n`;
    result += `• 使用 helm_upgrade 更新 release 配置\n`;
    result += `• 使用 helm_history 查看配置變更歷史\n`;

    if (!allValues) {
      result += `• 使用 allValues=true 查看所有值（包括預設值）\n`;
    }

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

    if (errorMessage.includes('revision')) {
      let result = `指定的修訂版本不存在。\n\n`;
      result += `錯誤訊息: ${errorMessage}\n\n`;

      result += `建議操作：\n`;
      result += `• 使用 helm_history 查看可用的修訂版本\n`;
      result += `• 不指定 revision 參數以查看最新版本\n`;
      result += `• 檢查修訂版本號是否正確\n`;

      return result;
    }

    return errorMessage;
  }
}