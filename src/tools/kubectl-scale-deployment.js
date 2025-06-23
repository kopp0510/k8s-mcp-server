/**
 * 擴縮 Kubernetes Deployment 副本數量
 * 支援動態調整 Deployment 的副本數，包含安全驗證和等待機制
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';

export class KubectlScaleDeploymentTool extends BaseTool {
  constructor() {
    super('kubectl_scale_deployment', '擴縮 Kubernetes Deployment 的副本數量');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          deploymentName: {
            type: 'string',
            description: 'Deployment 名稱'
          },
          replicas: {
            type: 'integer',
            description: '目標副本數量（0-100）',
            minimum: 0,
            maximum: 100
          },
          namespace: {
            type: 'string',
            description: 'Kubernetes 命名空間（預設：default）'
          },
          wait: {
            type: 'boolean',
            description: '是否等待擴縮完成（預設：false）'
          },
          timeout: {
            type: 'integer',
            description: '等待超時時間（秒，預設：300）',
            minimum: 30,
            maximum: 1800
          }
        },
        required: ['deploymentName', 'replicas']
      }
    };
  }

  async execute(args) {
    try {
      this.validateInput(args);

      const {
        deploymentName,
        replicas,
        namespace = 'default',
        wait = false,
        timeout = 300
      } = args;

      // 檢查 Deployment 是否存在並取得當前狀態
      const currentState = await this.getDeploymentState(deploymentName, namespace);

      // 執行擴縮操作
      await this.scaleDeployment(deploymentName, replicas, namespace);

      // 如果需要等待，則等待擴縮完成
      let afterState;
      if (wait) {
        afterState = await this.waitForScaleComplete(deploymentName, replicas, namespace, timeout);
      } else {
        // 短暫等待後取得狀態
        await this.sleep(2000);
        afterState = await this.getDeploymentState(deploymentName, namespace);
      }

      // 格式化最終結果
      const result = this.formatScaleResult(currentState, afterState, replicas, wait);

      this.logSuccess(args, result);
      return this.createResponse(result);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(error.message);
    }
  }

  async getDeploymentState(deploymentName, namespace) {
    try {
      const command = ['get', 'deployment', deploymentName, '-n', namespace, '-o', 'json'];
      const result = await kubectl.execute(command);

      const deployment = JSON.parse(result);

      return {
        name: deployment.metadata.name,
        namespace: deployment.metadata.namespace,
        currentReplicas: deployment.status.replicas || 0,
        readyReplicas: deployment.status.readyReplicas || 0,
        availableReplicas: deployment.status.availableReplicas || 0,
        desiredReplicas: deployment.spec.replicas || 0,
        conditions: deployment.status.conditions || [],
        creationTimestamp: deployment.metadata.creationTimestamp
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new Error(`Deployment "${deploymentName}" 在命名空間 "${namespace}" 中不存在。請確認 Deployment 名稱和命名空間是否正確。`);
      }
      throw new Error(`無法取得 Deployment 狀態: ${error.message}`);
    }
  }

  async scaleDeployment(deploymentName, replicas, namespace) {
    try {
      const command = ['scale', 'deployment', deploymentName, '--replicas', replicas.toString(), '-n', namespace];
      await kubectl.execute(command);
    } catch (error) {
      throw new Error(`擴縮 Deployment 失敗: ${error.message}`);
    }
  }

  async waitForScaleComplete(deploymentName, targetReplicas, namespace, timeout) {
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const state = await this.getDeploymentState(deploymentName, namespace);

        // 檢查是否達到目標狀態
        if (targetReplicas === 0) {
          // 縮容到 0：檢查當前副本數是否為 0
          if (state.currentReplicas === 0) {
            return state;
          }
        } else {
          // 擴容：檢查 Ready 副本數是否達到目標
          if (state.readyReplicas === targetReplicas && state.availableReplicas === targetReplicas) {
            return state;
          }
        }

        // 等待 2 秒後重試
        await this.sleep(2000);
      } catch (error) {
        // 如果取得狀態失敗，等待一下再重試
        await this.sleep(3000);
      }
    }

    // 超時，取得最終狀態
    const finalState = await this.getDeploymentState(deploymentName, namespace);
    finalState.timeout = true;
    return finalState;
  }

  formatScaleResult(beforeState, afterState, targetReplicas, waited) {
    let result = `Deployment 擴縮操作結果\n`;
    result += `==================================================\n\n`;

    // 操作摘要
    result += `操作摘要：\n`;
    result += `• Deployment: ${beforeState.name}\n`;
    result += `• 命名空間: ${beforeState.namespace}\n`;
    result += `• 原副本數: ${beforeState.desiredReplicas} → 目標副本數: ${targetReplicas}\n`;
    result += `• 變化: ${targetReplicas > beforeState.desiredReplicas ? '擴容' : targetReplicas < beforeState.desiredReplicas ? '縮容' : '無變化'} `;

    if (targetReplicas !== beforeState.desiredReplicas) {
      const change = Math.abs(targetReplicas - beforeState.desiredReplicas);
      result += `(${targetReplicas > beforeState.desiredReplicas ? '+' : '-'}${change} 個副本)\n\n`;
    } else {
      result += '\n\n';
    }

    // 詳細狀態對比
    result += `狀態對比：\n`;
    result += `┌────────────────────┬──────────┬──────────┐\n`;
    result += `│ 項目               │ 操作前   │ 操作後   │\n`;
    result += `├────────────────────┼──────────┼──────────┤\n`;
    result += `│ 期望副本數         │ ${beforeState.desiredReplicas.toString().padEnd(8)} │ ${afterState.desiredReplicas.toString().padEnd(8)} │\n`;
    result += `│ 當前副本數         │ ${beforeState.currentReplicas.toString().padEnd(8)} │ ${afterState.currentReplicas.toString().padEnd(8)} │\n`;
    result += `│ 就緒副本數         │ ${beforeState.readyReplicas.toString().padEnd(8)} │ ${afterState.readyReplicas.toString().padEnd(8)} │\n`;
    result += `│ 可用副本數         │ ${beforeState.availableReplicas.toString().padEnd(8)} │ ${afterState.availableReplicas.toString().padEnd(8)} │\n`;
    result += `└────────────────────┴──────────┴──────────┘\n\n`;

    // 操作結果分析
    result += `操作結果：\n`;

    if (afterState.timeout) {
      result += `[警告] 等待超時，擴縮操作可能仍在進行中\n`;
    }

    if (afterState.desiredReplicas === targetReplicas) {
      result += `[成功] Deployment 規格已成功更新到目標副本數\n`;
    } else {
      result += `[失敗] Deployment 規格更新失敗\n`;
    }

    if (targetReplicas === 0) {
      if (afterState.currentReplicas === 0) {
        result += `[成功] 所有 Pod 已成功終止\n`;
      } else {
        result += `[進行中] 正在終止 Pod，剩餘 ${afterState.currentReplicas} 個 Pod\n`;
      }
    } else {
      if (afterState.readyReplicas === targetReplicas) {
        result += `[成功] 所有目標副本已就緒並可用\n`;
      } else if (afterState.readyReplicas < targetReplicas) {
        result += `[進行中] 正在啟動新 Pod，已就緒 ${afterState.readyReplicas}/${targetReplicas} 個副本\n`;
      }
    }

    // 等待資訊
    if (waited) {
      result += `\n等待資訊：\n`;
      if (afterState.timeout) {
        result += `• 已等待超時，建議稍後檢查狀態\n`;
      } else {
        result += `• 已等待擴縮完成\n`;
      }
    } else {
      result += `\n提示：\n`;
      result += `• 此操作未等待完成，Pod 可能仍在啟動或終止中\n`;
    }

    result += `• 使用 kubectl_get 檢查 Deployment 狀態：{"resource": "deployments", "namespace": "${afterState.namespace}", "name": "${afterState.name}"}\n`;
    result += `• 使用 kubectl_get 檢查 Pod 狀態：{"resource": "pods", "namespace": "${afterState.namespace}"}\n`;
    result += `• 使用 kubectl_describe 查看詳細資訊：{"resource": "deployment", "name": "${afterState.name}", "namespace": "${afterState.namespace}"}`;

    return result;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}