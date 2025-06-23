/**
 * 重啟 Kubernetes Deployment
 * 支援安全重啟 Deployment，觸發 Pod 重新創建和部署
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';

export class KubectlRestartDeploymentTool extends BaseTool {
  constructor() {
    super('kubectl_restart_deployment', '重啟 Kubernetes Deployment');
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
          namespace: {
            type: 'string',
            description: 'Kubernetes 命名空間（預設：default）'
          },
          wait: {
            type: 'boolean',
            description: '是否等待重啟完成（預設：false）'
          },
          timeout: {
            type: 'integer',
            description: '等待超時時間（秒，預設：300）',
            minimum: 30,
            maximum: 1800
          }
        },
        required: ['deploymentName']
      }
    };
  }

  async execute(args) {
    try {
      this.validateInput(args);

      const {
        deploymentName,
        namespace = 'default',
        wait = false,
        timeout = 300
      } = args;

      // 檢查 Deployment 是否存在並取得當前狀態
      const beforeState = await this.getDeploymentState(deploymentName, namespace);

      // 執行重啟操作
      await this.restartDeployment(deploymentName, namespace);

      // 如果需要等待，則等待重啟完成
      let afterState;
      if (wait) {
        afterState = await this.waitForRestartComplete(deploymentName, namespace, timeout, beforeState.generation);
      } else {
        // 短暫等待後取得狀態
        await this.sleep(3000);
        afterState = await this.getDeploymentState(deploymentName, namespace);
      }

      // 格式化最終結果
      const result = this.formatRestartResult(beforeState, afterState, wait);

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
        generation: deployment.metadata.generation || 0,
        observedGeneration: deployment.status.observedGeneration || 0,
        replicas: deployment.spec.replicas || 0,
        currentReplicas: deployment.status.replicas || 0,
        readyReplicas: deployment.status.readyReplicas || 0,
        availableReplicas: deployment.status.availableReplicas || 0,
        updatedReplicas: deployment.status.updatedReplicas || 0,
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

  async restartDeployment(deploymentName, namespace) {
    try {
      const command = ['rollout', 'restart', 'deployment', deploymentName, '-n', namespace];
      await kubectl.execute(command);
    } catch (error) {
      throw new Error(`重啟 Deployment 失敗: ${error.message}`);
    }
  }

  async waitForRestartComplete(deploymentName, namespace, timeout, originalGeneration) {
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const state = await this.getDeploymentState(deploymentName, namespace);

        // 檢查是否重啟完成
        // 1. generation 應該比原始值大（表示 spec 已更新）
        // 2. observedGeneration 應該等於新的 generation（表示 controller 已觀察到更新）
        // 3. updatedReplicas 應該等於期望的 replicas（表示所有 Pod 已更新）
        // 4. readyReplicas 應該等於期望的 replicas（表示所有 Pod 已就緒）
        if (state.generation > originalGeneration &&
            state.observedGeneration === state.generation &&
            state.updatedReplicas === state.replicas &&
            state.readyReplicas === state.replicas &&
            state.availableReplicas === state.replicas) {
          return state;
        }

        // 等待 3 秒後重試
        await this.sleep(3000);
      } catch (error) {
        // 如果取得狀態失敗，等待一下再重試
        await this.sleep(5000);
      }
    }

    // 超時，取得最終狀態
    const finalState = await this.getDeploymentState(deploymentName, namespace);
    finalState.timeout = true;
    return finalState;
  }

  formatRestartResult(beforeState, afterState, waited) {
    let result = `Deployment 重啟操作結果\n`;
    result += `==================================================\n\n`;

    // 操作摘要
    result += `操作摘要：\n`;
    result += `• Deployment: ${beforeState.name}\n`;
    result += `• 命名空間: ${beforeState.namespace}\n`;
    result += `• 副本數: ${beforeState.replicas}\n`;
    result += `• 操作類型: 滾動重啟\n\n`;

    // 版本資訊
    result += `版本資訊：\n`;
    result += `• 重啟前 Generation: ${beforeState.generation}\n`;
    result += `• 重啟後 Generation: ${afterState.generation}\n`;
    result += `• 版本變化: ${afterState.generation > beforeState.generation ? '已更新' : '未變化'}\n\n`;

    // 詳細狀態對比
    result += `狀態對比：\n`;
    result += `┌────────────────────┬──────────┬──────────┐\n`;
    result += `│ 項目               │ 重啟前   │ 重啟後   │\n`;
    result += `├────────────────────┼──────────┼──────────┤\n`;
    result += `│ Generation         │ ${beforeState.generation.toString().padEnd(8)} │ ${afterState.generation.toString().padEnd(8)} │\n`;
    result += `│ Observed Generation│ ${beforeState.observedGeneration.toString().padEnd(8)} │ ${afterState.observedGeneration.toString().padEnd(8)} │\n`;
    result += `│ 總副本數           │ ${beforeState.currentReplicas.toString().padEnd(8)} │ ${afterState.currentReplicas.toString().padEnd(8)} │\n`;
    result += `│ 已更新副本數       │ ${beforeState.updatedReplicas.toString().padEnd(8)} │ ${afterState.updatedReplicas.toString().padEnd(8)} │\n`;
    result += `│ 就緒副本數         │ ${beforeState.readyReplicas.toString().padEnd(8)} │ ${afterState.readyReplicas.toString().padEnd(8)} │\n`;
    result += `│ 可用副本數         │ ${beforeState.availableReplicas.toString().padEnd(8)} │ ${afterState.availableReplicas.toString().padEnd(8)} │\n`;
    result += `└────────────────────┴──────────┴──────────┘\n\n`;

    // 操作結果分析
    result += `操作結果：\n`;

    if (afterState.timeout) {
      result += `[警告] 等待超時，重啟操作可能仍在進行中\n`;
    }

    if (afterState.generation > beforeState.generation) {
      result += `[成功] Deployment 規格已成功更新，觸發滾動重啟\n`;
    } else {
      result += `[警告] Deployment 規格可能未更新\n`;
    }

    if (afterState.observedGeneration === afterState.generation) {
      result += `[成功] Controller 已觀察到最新規格\n`;
    } else {
      result += `[進行中] Controller 正在處理規格更新\n`;
    }

    if (afterState.updatedReplicas === afterState.replicas) {
      result += `[成功] 所有 Pod 已更新到最新版本\n`;
    } else {
      result += `[進行中] 正在更新 Pod，已更新 ${afterState.updatedReplicas}/${afterState.replicas} 個副本\n`;
    }

    if (afterState.readyReplicas === afterState.replicas) {
      result += `[成功] 所有 Pod 已就緒並可用\n`;
    } else {
      result += `[進行中] 正在啟動 Pod，已就緒 ${afterState.readyReplicas}/${afterState.replicas} 個副本\n`;
    }

    // 等待資訊
    if (waited) {
      result += `\n等待資訊：\n`;
      if (afterState.timeout) {
        result += `• 已等待超時，建議稍後檢查狀態\n`;
      } else {
        result += `• 已等待重啟完成\n`;
      }
    } else {
      result += `\n提示：\n`;
      result += `• 此操作未等待完成，Pod 可能仍在重啟中\n`;
    }

    result += `• 使用 kubectl_get 檢查 Deployment 狀態：{"resource": "deployments", "namespace": "${afterState.namespace}", "name": "${afterState.name}"}\n`;
    result += `• 使用 kubectl_get 檢查 Pod 狀態：{"resource": "pods", "namespace": "${afterState.namespace}"}\n`;
    result += `• 使用 kubectl_describe 查看詳細資訊：{"resource": "deployment", "name": "${afterState.name}", "namespace": "${afterState.namespace}"}\n`;
    result += `• 使用 kubectl_logs 查看新 Pod 日誌`;

    return result;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}