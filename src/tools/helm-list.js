/**
 * Helm List 工具
 * 列出 Helm releases
 */

import { BaseTool } from './base-tool.js';
import { helm } from '../utils/helm.js';
import { logger } from '../utils/logger.js';

export class HelmListTool extends BaseTool {
  constructor() {
    super('helm_list', '列出 Helm releases，支援多種篩選選項（包含 -A 參數）');
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
            description: 'Kubernetes 命名空間（可選，預設為所有命名空間）'
          },
          allNamespaces: {
            type: 'boolean',
            description: '顯示所有命名空間的 releases，等同於 helm ls -A（預設：true）',
            default: true
          },
          status: {
            type: 'string',
            description: '按狀態篩選 releases（可選）：all=所有狀態，deployed=已部署（預設），failed=失敗，uninstalled=已卸載，superseded=被取代，pending=待處理',
            enum: ['all', 'deployed', 'failed', 'uninstalled', 'superseded', 'pending']
          },
          filter: {
            type: 'string',
            description: 'Release 名稱篩選器（支援正則表達式）'
          },
          short: {
            type: 'boolean',
            description: '使用簡短輸出格式（預設：false）',
            default: false
          },
          date: {
            type: 'boolean',
            description: '包含上次部署時間（預設：true）',
            default: true
          },
          reverse: {
            type: 'boolean',
            description: '反向排序結果（預設：false）',
            default: false
          },
          max: {
            type: 'integer',
            description: '最大結果數量（預設：256）',
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

      // 驗證參數組合 - 只有在明確設置 allNamespaces 時才檢查衝突
      if (namespace && args.allNamespaces === true) {
        throw new Error('namespace 和 allNamespaces 參數不能同時使用');
      }

      // 如果指定了 namespace，則不使用 allNamespaces
      const effectiveAllNamespaces = namespace ? false : allNamespaces;

      // 建構 helm list 指令
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

      // 記錄調試信息
      logger.debug(`HelmListTool 執行參數:`, {
        原始參數: args,
        處理後參數: commandOptions,
        最終命令: `helm ${command.join(' ')}`
      });

      // 執行指令
      const output = await helm.execute(command);

      // 格式化輸出
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

    // 命名空間參數處理
    if (namespace) {
      // 指定特定命名空間
      command.push('--namespace', namespace);
    } else if (allNamespaces === false) {
      // 明確設置不使用所有命名空間，使用當前命名空間
      // 不添加任何命名空間參數
    } else {
      // 預設或明確設置使用所有命名空間
      command.push('-A');
    }

    // 狀態篩選 - 根據 helm 的實際參數處理
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
          // deployed 是預設狀態，不需要額外參數
          break;
      }
    }

    // 名稱篩選
    if (filter) {
      command.push(filter);
    }

    // 輸出格式
    if (short) {
      command.push('--short');
    }

    // 時間顯示
    if (date) {
      command.push('--date');
    }

    // 排序
    if (reverse) {
      command.push('--reverse');
    }

    // 結果數量限制
    if (max !== undefined && max !== null) {
      command.push('--max', max.toString());
    }

    // 輸出格式
    command.push('--output', 'table');

    return command;
  }

  formatListOutput(output, args) {
    // 記錄原始輸出用於調試
    logger.debug(`Helm 原始輸出長度: ${output.length}`);
    logger.debug(`Helm 原始輸出前 500 字符: ${JSON.stringify(output.substring(0, 500))}`);

    if (!output.trim()) {
      logger.debug('Helm 輸出為空');
      return this.formatEmptyResult(args);
    }

    const lines = output.trim().split('\n');
    logger.debug(`Helm 輸出總行數: ${lines.length}`);

    // 找到真正的資料行（包含制表符的行通常是資料行）
    const dataLines = [];
    let headerProcessed = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      logger.debug(`行 ${i}: "${line.substring(0, 100)}${line.length > 100 ? '...' : ''}"`);

      // 跳過空行
      if (!line) {
        continue;
      }

      // 檢查是否為資料行（包含制表符且不是純標題）
      if (line.includes('\t')) {
        // 如果這行包含典型的 helm release 欄位，則視為資料行
        const fields = line.split('\t');
        if (fields.length >= 4) {
          // 檢查是否包含 helm release 的典型欄位模式
          // 第二個欄位應該是命名空間，第三個是修訂版本號，第五個是狀態
          if (fields[1] && fields[2] && fields[4] &&
              (fields[4].includes('deployed') || fields[4].includes('failed') ||
               fields[4].includes('pending') || fields[4].includes('superseded'))) {
            dataLines.push(line);
            headerProcessed = true;
          }
        }
      }
    }

    logger.debug(`找到的資料行數: ${dataLines.length}`);

    if (dataLines.length === 0) {
      logger.debug('沒有找到有效的 release 資料行');
      return this.formatEmptyResult(args);
    }

    let result = `Helm Releases 列表\n`;
    result += `==================================================\n\n`;

    // 執行的命令資訊
    if (args.allNamespaces !== false && !args.namespace) {
      result += `查詢範圍: 所有命名空間 (使用 -A 參數)\n`;
    } else if (args.namespace) {
      result += `查詢範圍: 命名空間 "${args.namespace}"\n`;
    } else {
      result += `查詢範圍: 當前命名空間\n`;
    }

    // 篩選資訊
    if (args.status && args.status.trim() !== '') {
      result += `狀態篩選: 只顯示 "${args.status}" 狀態的 releases\n`;
    }
    if (args.filter && args.filter.trim() !== '') {
      result += `名稱篩選: ${args.filter}\n`;
    }

    // 統計資訊
    result += `找到 ${dataLines.length} 個 Helm release`;
    if (args.status && args.status.trim() !== '') {
      result += ` (僅 ${args.status} 狀態)`;
    }
    result += `:\n\n`;

    // 表格標題
    result += `${'NAME'.padEnd(20)} ${'NAMESPACE'.padEnd(15)} ${'REVISION'.padEnd(8)} ${'STATUS'.padEnd(12)} ${'CHART'.padEnd(30)} APP VERSION\n`;
    result += `${'='.repeat(100)}\n`;

    // 格式化每個 release
    dataLines.forEach(line => {
      const fields = line.split('\t').map(f => f.trim());
      if (fields.length >= 6) {
        const [name, namespace, revision, updated, status, chart, appVersion] = fields;
        result += `${name.padEnd(20)} ${namespace.padEnd(15)} ${revision.padEnd(8)} ${status.padEnd(12)} ${chart.padEnd(30)} ${appVersion || 'N/A'}\n`;
      } else {
        // 如果欄位不足，直接顯示原始行
        result += `${line}\n`;
      }
    });

    // 新增提示資訊
    result += `\n說明：\n`;
    result += `• NAME: Release 名稱\n`;
    result += `• NAMESPACE: 部署的命名空間\n`;
    result += `• REVISION: 修訂版本號\n`;
    result += `• STATUS: 部署狀態\n`;
    result += `• CHART: 使用的 Chart 名稱和版本\n`;
    result += `• APP VERSION: 應用程式版本\n\n`;

    result += `提示：\n`;
    result += `• 使用 helm_status 查看 release 詳細狀態\n`;
    result += `• 使用 helm_get_values 查看 release 配置值\n`;
    result += `• 使用 helm_history 查看 release 歷史記錄\n`;

    return result;
  }

  formatEmptyResult(args) {
    let result = `Helm Releases 列表\n`;
    result += `==================================================\n\n`;

    if (args.namespace) {
      result += `命名空間 "${args.namespace}" 中沒有找到 Helm release。\n\n`;
      result += `可能的原因：\n`;
      result += `• 命名空間中確實沒有部署 Helm releases\n`;
      result += `• 命名空間 "${args.namespace}" 不存在\n`;
      result += `• 沒有權限訪問此命名空間\n\n`;
    } else if (args.allNamespaces !== false) {
      result += `使用 -A 參數查看所有命名空間，但沒有找到`;
      if (args.status && args.status.trim() !== '') {
        result += `狀態為 "${args.status}" 的`;
      }
      result += ` Helm release。\n\n`;
      result += `可能的原因：\n`;
      if (args.status && args.status.trim() !== '') {
        result += `• 沒有狀態為 "${args.status}" 的 releases（試試移除 status 參數查看所有狀態）\n`;
      }
      result += `• 整個集群中確實沒有部署任何 Helm releases\n`;
      result += `• 沒有權限跨命名空間查看 releases（需要 cluster-wide 權限）\n`;
      result += `• kubeconfig 配置問題\n\n`;
    } else {
      result += `在當前命名空間中沒有找到`;
      if (args.status && args.status.trim() !== '') {
        result += `狀態為 "${args.status}" 的`;
      }
      result += ` Helm release。\n\n`;
    }

    result += `疑難排解：\n`;
    result += `• 檢查 kubeconfig 配置: kubectl config current-context\n`;
    result += `• 確認可訪問的命名空間: kubectl get namespaces\n`;
    result += `• 測試原生 helm 命令: helm ls -A\n`;
    result += `• 確保 Helm 已正確安裝和配置\n`;
    result += `• 使用 helm_repo_list 查看已添加的 Chart repositories\n`;

    return result;
  }
}