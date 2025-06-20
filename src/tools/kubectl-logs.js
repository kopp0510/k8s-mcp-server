import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';

export class KubectlLogsTool extends BaseTool {
  constructor() {
    super('kubectl_logs', '取得 Pod 日誌');
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
            description: 'Pod 名稱 (必填)',
          },
          namespace: {
            type: 'string',
            description: '命名空間 (預設為 default)',
            default: 'default',
          },
          container: {
            type: 'string',
            description: '容器名稱 (多容器 Pod 時需要指定)',
          },
          lines: {
            type: 'integer',
            description: '顯示最後 N 行日誌 (預設 100，最大 1000)',
            minimum: 1,
            maximum: 1000,
            default: 100,
          },
          since: {
            type: 'string',
            description: '顯示指定時間之後的日誌 (例如: 1h, 30m, 10s)',
          },
          follow: {
            type: 'boolean',
            description: '是否持續追蹤日誌 (預設 false，因安全考量)',
            default: false,
          },
          previous: {
            type: 'boolean',
            description: '是否顯示前一個容器實例的日誌 (預設 false)',
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

      // 安全限制：不允許 follow 模式，避免長時間運行
      if (follow) {
        throw new Error('基於安全考量，不支援 follow 模式');
      }

      // 限制行數
      const maxLines = Math.min(Math.max(1, lines), 1000);

      // 建構 kubectl logs 指令
      const kubectlArgs = ['logs', pod];

      // 添加 namespace
      if (namespace && namespace !== 'default') {
        kubectlArgs.push('-n', namespace);
      }

      // 添加容器名稱
      if (container) {
        kubectlArgs.push('-c', container);
      }

      // 添加行數限制
      kubectlArgs.push('--tail', maxLines.toString());

      // 添加時間限制
      if (since) {
        // 驗證時間格式 (簡單驗證)
        if (!/^\d+[smhd]$/.test(since)) {
          throw new Error('時間格式錯誤，應為數字加單位 (s/m/h/d)，例如: 30m, 1h, 2d');
        }
        kubectlArgs.push('--since', since);
      }

      // 添加 previous 選項
      if (previous) {
        kubectlArgs.push('--previous');
      }

      // 執行指令
      const result = await kubectl.execute(kubectlArgs);

      // 格式化回應
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

      // 回傳結構化的回應
      return {
        content: [
          {
            type: 'text',
            text: `Pod: ${pod} (namespace: ${namespace})${container ? `, container: ${container}` : ''}
行數: ${maxLines}${since ? `, 時間範圍: ${since}` : ''}${previous ? ', 前一個實例' : ''}
日誌長度: ${result.length} 字元

=== 日誌內容 ===
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