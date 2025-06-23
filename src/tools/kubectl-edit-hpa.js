/**
 * 編輯 Kubernetes HorizontalPodAutoscaler (HPA) 副本數量範圍
 * 僅允許修改 minReplicas 和 maxReplicas，確保安全性
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class KubectlEditHpaTool extends BaseTool {
  constructor() {
    super('kubectl_edit_hpa', '編輯 HorizontalPodAutoscaler 副本數量範圍');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          hpaName: {
            type: 'string',
            description: 'HorizontalPodAutoscaler 名稱'
          },
          minReplicas: {
            type: 'integer',
            description: '最小副本數量（1-100）'
          },
          maxReplicas: {
            type: 'integer',
            description: '最大副本數量（1-1000）'
          },
          namespace: {
            type: 'string',
            description: 'Kubernetes 命名空間（預設：default）'
          },
          wait: {
            type: 'boolean',
            description: '是否等待 HPA 狀態更新（預設：false）'
          },
          timeout: {
            type: 'integer',
            description: '等待超時時間（秒，預設：120）',
            minimum: 30,
            maximum: 600
          }
        },
        required: ['hpaName'],
        additionalProperties: false,
        description: '注意：minReplicas 和 maxReplicas 都是可選參數，只需提供要修改的參數即可'
      }
    };
  }

    async execute(args) {
    try {
      // 根據 k8s-mcp-server.mdc 規範，所有輸入必須通過驗證
      this.validateInput(args);

      const {
        hpaName,
        minReplicas,
        maxReplicas,
        namespace = 'default',
        wait = false,
        timeout = 120
      } = args;

      // 額外的業務邏輯驗證（符合安全要求）
      if (minReplicas !== undefined) {
        if (!Number.isInteger(minReplicas) || minReplicas < 1 || minReplicas > 100) {
          throw new Error(`minReplicas 必須是 1-100 之間的整數，但收到: ${minReplicas}`);
        }
      }

      if (maxReplicas !== undefined) {
        if (!Number.isInteger(maxReplicas) || maxReplicas < 1 || maxReplicas > 1000) {
          throw new Error(`maxReplicas 必須是 1-1000 之間的整數，但收到: ${maxReplicas}`);
        }
      }

      if (minReplicas !== undefined && maxReplicas !== undefined) {
        if (minReplicas > maxReplicas) {
          throw new Error(`最小副本數 (${minReplicas}) 不能大於最大副本數 (${maxReplicas})`);
        }
      }

      // 確保至少有一個參數要修改
      if (minReplicas === undefined && maxReplicas === undefined) {
        throw new Error('必須提供 minReplicas 或 maxReplicas 參數');
      }

      // 檢查 HPA 是否存在並取得當前狀態
      const beforeState = await this.getHpaState(hpaName, namespace);

      // 驗證新的範圍是否合理
      const newMinReplicas = minReplicas !== undefined ? minReplicas : beforeState.minReplicas;
      const newMaxReplicas = maxReplicas !== undefined ? maxReplicas : beforeState.maxReplicas;



      if (newMinReplicas > newMaxReplicas) {
        throw new Error(`新的最小副本數 (${newMinReplicas}) 不能大於最大副本數 (${newMaxReplicas})`);
      }

      // 檢查是否有實際變更
      if (newMinReplicas === beforeState.minReplicas && newMaxReplicas === beforeState.maxReplicas) {
        throw new Error('沒有需要更新的參數，當前 HPA 設定已經是指定的值');
      }

      // 執行 HPA 編輯操作
      await this.editHpa(hpaName, namespace, newMinReplicas, newMaxReplicas, beforeState.minReplicas, beforeState.maxReplicas);

      // 如果需要等待，則等待 HPA 狀態更新
      let afterState;
      if (wait) {
        afterState = await this.waitForHpaUpdate(hpaName, namespace, timeout, newMinReplicas, newMaxReplicas);
      } else {
        // 短暫等待後取得狀態
        await this.sleep(2000);
        afterState = await this.getHpaState(hpaName, namespace);
      }

      // 格式化最終結果
      const result = this.formatEditResult(beforeState, afterState, wait, {
        minReplicas: newMinReplicas,
        maxReplicas: newMaxReplicas
      });

      this.logSuccess(args, result);
      return this.createResponse(result);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(error.message);
    }
  }

  async getHpaState(hpaName, namespace) {
    try {
      const command = ['get', 'hpa', hpaName, '-n', namespace, '-o', 'json'];
      const result = await kubectl.execute(command);

      const hpa = JSON.parse(result);



      return {
        name: hpa.metadata.name,
        namespace: hpa.metadata.namespace,
        minReplicas: hpa.spec.minReplicas || 1,
        maxReplicas: hpa.spec.maxReplicas || 10,
        currentReplicas: hpa.status.currentReplicas || 0,
        desiredReplicas: hpa.status.desiredReplicas || 0,
        targetCPUUtilizationPercentage: hpa.spec.targetCPUUtilizationPercentage || null,
        scaleTargetRef: hpa.spec.scaleTargetRef || {},
        conditions: hpa.status.conditions || [],
        lastScaleTime: hpa.status.lastScaleTime || null,
        generation: hpa.metadata.generation || 0,
        observedGeneration: hpa.status.observedGeneration || 0
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new Error(`HorizontalPodAutoscaler "${hpaName}" 在命名空間 "${namespace}" 中不存在。請確認 HPA 名稱和命名空間是否正確。`);
      }
      throw new Error(`無法取得 HPA 狀態: ${error.message}`);
    }
  }

  async editHpa(hpaName, namespace, minReplicas, maxReplicas, originalMinReplicas, originalMaxReplicas) {
    try {
      // 使用臨時文件方法避免 JSON 引號在 shell 中的問題
      // 符合 k8s-mcp-server 安全規範，使用 --patch-file 選項

      // 只包含實際需要修改的欄位
      const patchData = {
        spec: {}
      };

      // 只有當值與原值不同時才包含在 patch 中
      if (minReplicas !== originalMinReplicas) {
        patchData.spec.minReplicas = minReplicas;
      }

      if (maxReplicas !== originalMaxReplicas) {
        patchData.spec.maxReplicas = maxReplicas;
      }

      // 創建臨時文件
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `hpa-patch-${Date.now()}.json`);

      try {
        // 寫入 patch 資料到臨時文件
        await fs.writeFile(tempFile, JSON.stringify(patchData, null, 2));

        // 使用 --patch-file 參數避免命令行 JSON 引號問題
        const command = [
          'patch', 'hpa', hpaName,
          '-n', namespace,
          '--type', 'strategic',
          '--patch-file', tempFile
        ];

        await kubectl.execute(command);

      } finally {
        // 清理臨時文件
        try {
          await fs.unlink(tempFile);
        } catch (cleanupError) {
          // 忽略清理錯誤
        }
      }

    } catch (error) {
      throw new Error(`編輯 HPA 失敗: ${error.message}`);
    }
  }

  async waitForHpaUpdate(hpaName, namespace, timeout, expectedMinReplicas, expectedMaxReplicas) {
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const state = await this.getHpaState(hpaName, namespace);

        // 檢查是否已更新到期望值
        if (state.minReplicas === expectedMinReplicas &&
            state.maxReplicas === expectedMaxReplicas &&
            state.observedGeneration >= state.generation) {
          return state;
        }

        // 等待 2 秒後重試
        await this.sleep(2000);
      } catch (error) {
        // 如果取得狀態失敗，等待一下再重試
        await this.sleep(3000);
      }
    }

    // 超時，取得最終狀態
    const finalState = await this.getHpaState(hpaName, namespace);
    finalState.timeout = true;
    return finalState;
  }

  formatEditResult(beforeState, afterState, waited, expectedValues) {
    let result = `HorizontalPodAutoscaler 編輯操作結果\n`;
    result += `==================================================\n\n`;

    // 操作摘要
    result += `操作摘要：\n`;
    result += `• HPA: ${beforeState.name}\n`;
    result += `• 命名空間: ${beforeState.namespace}\n`;
    result += `• 擴縮目標: ${beforeState.scaleTargetRef.kind}/${beforeState.scaleTargetRef.name}\n`;
    result += `• 操作類型: 副本數量範圍調整\n\n`;

    // 變更詳情
    result += `變更詳情：\n`;

    // 只顯示實際有變更的項目
    if (beforeState.minReplicas !== expectedValues.minReplicas) {
      result += `• 最小副本數: ${beforeState.minReplicas} → ${expectedValues.minReplicas}`;
      const change = expectedValues.minReplicas - beforeState.minReplicas;
      result += ` (${change > 0 ? '+' : ''}${change})`;
      result += `\n`;
    } else {
      result += `• 最小副本數: ${beforeState.minReplicas} (無變更)\n`;
    }

    if (beforeState.maxReplicas !== expectedValues.maxReplicas) {
      result += `• 最大副本數: ${beforeState.maxReplicas} → ${expectedValues.maxReplicas}`;
      const change = expectedValues.maxReplicas - beforeState.maxReplicas;
      result += ` (${change > 0 ? '+' : ''}${change})`;
      result += `\n`;
    } else {
      result += `• 最大副本數: ${beforeState.maxReplicas} (無變更)\n`;
    }
    result += `\n`;

    // 詳細狀態對比
    result += `狀態對比：\n`;
    result += `┌────────────────────┬──────────┬──────────┐\n`;
    result += `│ 項目               │ 編輯前   │ 編輯後   │\n`;
    result += `├────────────────────┼──────────┼──────────┤\n`;
    result += `│ 最小副本數         │ ${beforeState.minReplicas.toString().padEnd(8)} │ ${afterState.minReplicas.toString().padEnd(8)} │\n`;
    result += `│ 最大副本數         │ ${beforeState.maxReplicas.toString().padEnd(8)} │ ${afterState.maxReplicas.toString().padEnd(8)} │\n`;
    result += `│ 當前副本數         │ ${beforeState.currentReplicas.toString().padEnd(8)} │ ${afterState.currentReplicas.toString().padEnd(8)} │\n`;
    result += `│ 期望副本數         │ ${beforeState.desiredReplicas.toString().padEnd(8)} │ ${afterState.desiredReplicas.toString().padEnd(8)} │\n`;
    result += `│ Generation         │ ${beforeState.generation.toString().padEnd(8)} │ ${afterState.generation.toString().padEnd(8)} │\n`;
    result += `│ Observed Generation│ ${beforeState.observedGeneration.toString().padEnd(8)} │ ${afterState.observedGeneration.toString().padEnd(8)} │\n`;
    result += `└────────────────────┴──────────┴──────────┘\n\n`;

    // 操作結果分析
    result += `操作結果：\n`;

    if (afterState.timeout) {
      result += `[警告] 等待超時，HPA 更新可能仍在進行中\n`;
    }

    if (afterState.minReplicas === expectedValues.minReplicas &&
        afterState.maxReplicas === expectedValues.maxReplicas) {
      result += `[成功] HPA 規格已成功更新到目標值\n`;
    } else {
      result += `[警告] HPA 規格可能未完全更新\n`;
    }

    if (afterState.observedGeneration >= afterState.generation) {
      result += `[成功] Controller 已觀察到最新規格\n`;
    } else {
      result += `[進行中] Controller 正在處理規格更新\n`;
    }

    // 擴縮影響分析
    const currentReplicas = afterState.currentReplicas;
    if (currentReplicas < afterState.minReplicas) {
      result += `[提示] 當前副本數 (${currentReplicas}) 低於新的最小值，HPA 可能會觸發擴容\n`;
    } else if (currentReplicas > afterState.maxReplicas) {
      result += `[提示] 當前副本數 (${currentReplicas}) 超過新的最大值，HPA 可能會觸發縮容\n`;
    } else {
      result += `[正常] 當前副本數在新的範圍內，HPA 將根據指標動態調整\n`;
    }

    // 等待資訊
    if (waited) {
      result += `\n等待資訊：\n`;
      if (afterState.timeout) {
        result += `• 已等待超時，建議稍後檢查狀態\n`;
      } else {
        result += `• 已等待 HPA 規格更新完成\n`;
      }
    } else {
      result += `\n提示：\n`;
      result += `• 此操作未等待完成，HPA 可能仍在更新中\n`;
    }

    result += `• 使用 kubectl_get 檢查 HPA 狀態：{"resource": "hpa", "namespace": "${afterState.namespace}", "name": "${afterState.name}"}\n`;
    result += `• 使用 kubectl_get 檢查目標 Deployment：{"resource": "deployments", "namespace": "${afterState.namespace}"}\n`;
    result += `• 使用 kubectl_describe 查看詳細資訊：{"resource": "hpa", "name": "${afterState.name}", "namespace": "${afterState.namespace}"}\n`;
    result += `• HPA 將根據 CPU 使用率在 ${afterState.minReplicas}-${afterState.maxReplicas} 範圍內自動調整副本數`;

    return result;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}