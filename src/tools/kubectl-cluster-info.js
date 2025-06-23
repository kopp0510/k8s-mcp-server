/**
 * Kubectl Cluster Info 工具
 * 取得 Kubernetes 叢集資訊，包含控制平面和服務端點
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';

export class KubectlClusterInfoTool extends BaseTool {
  constructor() {
    super('kubectl_cluster_info', '取得 Kubernetes 叢集資訊，包含控制平面和服務端點');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          dump: {
            type: 'boolean',
            description: '取得詳細的叢集狀態轉儲資訊 (等同於 kubectl cluster-info dump)',
            default: false,
          },
        },
        required: [],
      },
    };
  }

  async execute(args) {
    try {
      this.validateInput(args);

      const { dump = false } = args;

      // 建構 kubectl 指令
      const kubectlArgs = ['cluster-info'];

      if (dump) {
        kubectlArgs.push('dump');
      }

      // 執行指令
      const result = await kubectl.execute(kubectlArgs);

      // 如果是 dump 模式，直接回傳原始輸出
      if (dump) {
        this.logSuccess(args, { content: [{ text: result }] });
        return this.createResponse(result);
      }

      // 一般模式，解析並格式化輸出
      const formattedResult = this.formatClusterInfo(result);

      this.logSuccess(args, { content: [{ text: formattedResult }] });
      return this.createResponse(formattedResult);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(error.message);
    }
  }

  formatClusterInfo(rawOutput) {
    const lines = rawOutput.split('\n').filter(line => line.trim());
    let formatted = '叢集資訊\n' + '='.repeat(50) + '\n\n';

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('Kubernetes control plane')) {
        formatted += `**控制平面**\n`;
        const url = trimmedLine.match(/https?:\/\/[^\s]+/);
        if (url) {
          formatted += `   端點: ${url[0]}\n\n`;
        }
      } else if (trimmedLine.startsWith('CoreDNS')) {
        formatted += `**CoreDNS**\n`;
        const url = trimmedLine.match(/https?:\/\/[^\s]+/);
        if (url) {
          formatted += `   端點: ${url[0]}\n\n`;
        }
      } else if (trimmedLine.includes('is running at')) {
        // 處理其他服務
        const serviceName = trimmedLine.split(' is running at')[0];
        const url = trimmedLine.match(/https?:\/\/[^\s]+/);
        if (url) {
          formatted += `**${serviceName}**\n`;
          formatted += `   端點: ${url[0]}\n\n`;
        }
      } else if (trimmedLine.startsWith('To further debug')) {
        formatted += `**除錯提示**\n`;
        formatted += `   ${trimmedLine}\n\n`;
      } else if (trimmedLine.includes('kubectl cluster-info dump')) {
        formatted += `**詳細資訊**\n`;
        formatted += `   使用 dump: true 參數取得完整的叢集狀態轉儲\n\n`;
      } else if (trimmedLine && !trimmedLine.includes('kubectl') && !trimmedLine.includes('cluster-info')) {
        // 其他重要資訊
        formatted += `${trimmedLine}\n\n`;
      }
    }

    return formatted.trim();
  }
}