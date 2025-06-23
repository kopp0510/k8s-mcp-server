import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';
import { validator } from '../utils/validator.js';
import { logger } from '../utils/logger.js';

/**
 * kubectl describe 工具
 * 取得 Kubernetes 資源的詳細描述資訊
 */
export class KubectlDescribeTool extends BaseTool {
  constructor() {
    super('kubectl_describe');
  }

  getDefinition() {
    return {
      name: this.name,
      description: '取得 Kubernetes 資源的詳細描述資訊，包含事件、狀態和配置',
      inputSchema: {
        type: 'object',
        properties: {
          resource: {
            type: 'string',
            enum: ['pod', 'node', 'service', 'deployment', 'configmap', 'secret'],
            description: '資源類型'
          },
          name: {
            type: 'string',
            description: '資源名稱'
          },
          namespace: {
            type: 'string',
            description: '命名空間 (對於有命名空間的資源，預設為 default)'
          }
        },
        required: ['resource', 'name']
      }
    };
  }

  async execute({ resource, name, namespace = 'default' }) {
    // 定義有命名空間的資源類型（移到函數頂部，避免作用域問題）
    const namespacedResources = ['pod', 'service', 'deployment', 'configmap', 'secret'];

    try {
      // 驗證輸入
      validator.validateInput({ resource, name, namespace });

      // 驗證資源名稱
      validator.validateResourceName(name);

      // 對於有命名空間的資源，驗證命名空間
      if (namespacedResources.includes(resource)) {
        validator.validateNamespace(namespace);
      }

      logger.info(`正在描述 ${resource}: ${name}`, { resource, name, namespace });

      // 建構 kubectl describe 指令
      let args = ['describe', resource, name];

      // 只有命名空間資源才需要指定命名空間
      if (namespacedResources.includes(resource)) {
        args.push('-n', namespace);
      }

      // 執行 kubectl describe
      const output = await kubectl.execute(args);

      // 格式化輸出
      const formattedOutput = this.formatDescribeOutput(resource, name, namespace, output);

      return {
        content: [{
          type: "text",
          text: formattedOutput
        }]
      };

    } catch (error) {
      logger.error(`kubectl describe 失敗: ${resource}/${name}`, error);

      // 處理常見錯誤
      let errorMessage = error.message || '未知錯誤';

      if (errorMessage.includes('not found')) {
        errorMessage = `找不到 ${resource} '${name}'`;
        if (namespacedResources.includes(resource)) {
          errorMessage += ` (命名空間: ${namespace})`;
        }
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('Forbidden')) {
                  errorMessage = `權限不足，無法描述 ${resource} '${name}'`;
      } else if (errorMessage.includes('connection refused')) {
                  errorMessage = '無法連接到 Kubernetes 叢集';
      }

      return {
        content: [{
          type: "text",
          text: errorMessage
        }],
        isError: true
      };
    }
  }

  /**
   * 格式化 describe 輸出
   */
  formatDescribeOutput(resource, name, namespace, rawOutput) {
    const namespacedResources = ['pod', 'service', 'deployment', 'configmap', 'secret'];

    let header = `${resource.toUpperCase()} 詳細資訊: ${name}`;

    if (namespacedResources.includes(resource)) {
      header += ` (命名空間: ${namespace})`;
    }

    let output = header + '\n';
    output += '='.repeat(header.length) + '\n\n';

    // 解析和格式化輸出
    const lines = rawOutput.split('\n');
    let currentSection = '';
    let inEventsSection = false;

    for (let line of lines) {
      const trimmedLine = line.trim();

      // 跳過空行
      if (!trimmedLine) {
        output += '\n';
        continue;
      }

      // 檢測主要區段
      if (trimmedLine.includes(':') && !trimmedLine.startsWith(' ') && !trimmedLine.includes('  ')) {
        if (trimmedLine.toLowerCase().includes('events')) {
          inEventsSection = true;
          output += '**事件記錄:**\n';
          output += '```\n';
        } else if (trimmedLine.toLowerCase().includes('conditions')) {
                      output += '**狀態條件:**\n';
        } else if (trimmedLine.toLowerCase().includes('labels')) {
          output += '**標籤:**\n';
        } else if (trimmedLine.toLowerCase().includes('annotations')) {
          output += '**註解:**\n';
        } else {
          // 其他區段標題
          currentSection = trimmedLine;
          output += `**${trimmedLine}**\n`;
        }
      } else {
        // 內容行
        if (inEventsSection) {
          output += line + '\n';
        } else {
          // 縮排內容
          output += `  ${trimmedLine}\n`;
        }
      }
    }

    // 如果在事件區段中，關閉程式碼區塊
    if (inEventsSection) {
      output += '```\n';
    }

    output += '\n**提示**: 使用 `kubectl_logs` 查看 Pod 日誌，使用 `kubectl_get` 查看資源列表\n';

    return output;
  }

  /**
   * 取得資源圖示
   */
  getResourceIcon(resource) {
    // 移除所有圖示，返回空字串
    return '';
  }
}