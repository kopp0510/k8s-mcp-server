/**
 * Helm History 工具
 * 查看 Helm release 的部署歷史記錄
 */

import { BaseTool } from './base-tool.js';
import { helm } from '../utils/helm.js';
import { logger } from '../utils/logger.js';

export class HelmHistoryTool extends BaseTool {
  constructor() {
    super('helm_history', '查看 Helm release 的部署歷史記錄');
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
            description: 'Helm release 名稱（必需）'
          },
          namespace: {
            type: 'string',
            description: 'Kubernetes 命名空間（可選）'
          },
          max: {
            type: 'integer',
            description: '顯示的歷史記錄數量上限（預設：256）',
            minimum: 1,
            maximum: 1000,
            default: 256
          },
          output: {
            type: 'string',
            description: '輸出格式（預設：table）',
            enum: ['table', 'json', 'yaml'],
            default: 'table'
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
        max = 256,
        output = 'table'
      } = args;

      // 驗證 release 名稱
      if (!releaseName || releaseName.trim() === '') {
        throw new Error('releaseName 參數不能為空');
      }

      // 建構 helm history 指令
      const command = this.buildHelmHistoryCommand({
        releaseName: releaseName.trim(),
        namespace,
        max,
        output
      });

      // 記錄調試信息
      logger.debug(`HelmHistoryTool 執行參數:`, {
        原始參數: args,
        最終命令: `helm ${command.join(' ')}`
      });

      // 執行指令
      const helmOutput = await helm.execute(command);

      // 格式化輸出
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

    // 命名空間參數
    if (namespace && namespace.trim() !== '') {
      command.push('--namespace', namespace.trim());
    }

    // 最大數量限制
    if (max && max !== 256) {
      command.push('--max', max.toString());
    }

    // 輸出格式
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

    // 如果是 JSON 或 YAML 格式，直接返回原始輸出
    if (outputFormat === 'json' || outputFormat === 'yaml') {
      const header = this.buildOutputHeader(args);
      return `${header}\n\n${output}`;
    }

    // 處理 table 格式輸出
    return this.formatTableOutput(output, args);
  }

  formatTableOutput(output, args) {
    const { releaseName, namespace } = args;
    const lines = output.trim().split('\n');

    if (lines.length === 0) {
      return this.formatEmptyResult(args);
    }

    // 建構輸出標題
    const header = this.buildOutputHeader(args);

    // 處理表格內容
    let formattedLines = [];
    let revisionCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === '') continue;

      // 如果是標題行
      if (line.includes('REVISION') && line.includes('UPDATED')) {
        formattedLines.push('');
        formattedLines.push(`歷史記錄詳情：`);
        formattedLines.push('=' * 50);
        formattedLines.push('');
        formattedLines.push(line);
        formattedLines.push('-'.repeat(line.length));
      } else if (line.match(/^\d+/)) {
        // 這是一個歷史記錄行
        revisionCount++;
        formattedLines.push(line);
      }
    }

    // 建構最終輸出
    let result = header;

    if (revisionCount > 0) {
      result += `\n\n找到 ${revisionCount} 個歷史記錄：`;
      result += formattedLines.join('\n');

      result += '\n\n說明：';
      result += '\n• REVISION：版本號碼（數字越大表示越新）';
      result += '\n• UPDATED：部署或更新時間';
      result += '\n• STATUS：部署狀態（deployed=已部署，failed=失敗，superseded=被取代等）';
      result += '\n• CHART：使用的 Chart 版本';
      result += '\n• APP VERSION：應用程式版本';
      result += '\n• DESCRIPTION：部署描述或變更說明';

      result += '\n\n提示：';
      result += `\n• 使用 helm_status 查看當前 release 詳細資訊`;
      result += `\n• 使用 helm_get_values 查看指定版本的配置值`;
      result += `\n• 最新版本是 revision ${revisionCount}`;
    } else {
      result += '\n\n' + this.formatEmptyResult(args).split('\n').slice(2).join('\n');
    }

    return result;
  }

  buildOutputHeader(args) {
    const { releaseName, namespace, max, output } = args;

    let header = `Helm Release 歷史記錄`;
    header += '\n' + '='.repeat(50);
    header += `\n\n• Release 名稱：${releaseName}`;

    if (namespace) {
      header += `\n• 命名空間：${namespace}`;
    } else {
      header += `\n• 命名空間：（當前命名空間）`;
    }

    if (max && max !== 256) {
      header += `\n• 最大記錄數：${max}`;
    }

    if (output && output !== 'table') {
      header += `\n• 輸出格式：${output}`;
    }

    return header;
  }

  formatEmptyResult(args) {
    const { releaseName, namespace } = args;

    let result = this.buildOutputHeader(args);
    result += `\n\n沒有找到 release "${releaseName}" 的歷史記錄。`;
    result += '\n\n可能的原因：';
    result += `\n• Release "${releaseName}" 不存在`;
    result += '\n• 指定的命名空間不正確';
    result += '\n• 沒有部署歷史記錄';

    result += '\n\n建議檢查：';
    result += '\n• 使用 helm_list 確認 release 名稱';
    if (namespace) {
      result += `\n• 確認命名空間 "${namespace}" 是否正確`;
    } else {
      result += '\n• 嘗試指定正確的命名空間';
    }

    return result;
  }
}