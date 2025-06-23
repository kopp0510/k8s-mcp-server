/**
 * 查看 Kubernetes 節點資源使用情況
 * 需要 metrics-server 支援
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';

export class KubectlTopNodesTool extends BaseTool {
  constructor() {
    super('kubectl_top_nodes', '查看 Kubernetes 節點的 CPU 和記憶體使用情況（需要 metrics-server）');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          sortBy: {
            type: 'string',
            description: '排序方式',
            enum: ['cpu', 'memory']
          }
        },
        required: []
      }
    };
  }

  async execute(args) {
    try {
      this.validateInput(args);

      const { sortBy } = args;

      // 檢查 metrics-server 是否安裝和運行
      await this.checkMetricsServer();

      // 構建 kubectl top nodes 命令
      const command = this.buildTopCommand(sortBy);

      // 執行命令
      const result = await kubectl.execute(command);

      // 格式化輸出
      const formattedResult = this.formatTopOutput(result);

      this.logSuccess(args, formattedResult);
      return this.createResponse(formattedResult);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(error.message);
    }
  }

  async checkMetricsServer() {
    try {
      // 檢查 metrics-server deployment 是否存在
      const checkCommand = ['get', 'deployment', 'metrics-server', '-n', 'kube-system', '-o', 'json'];
      const result = await kubectl.execute(checkCommand);

      const deployment = JSON.parse(result);

      // 檢查 deployment 狀態
      const status = deployment.status;
      const readyReplicas = status.readyReplicas || 0;
      const replicas = status.replicas || 0;

      if (readyReplicas === 0 || readyReplicas < replicas) {
        throw new Error(
          'metrics-server 已安裝但未就緒。請等待 metrics-server 完全啟動後再試。\n' +
          '檢查狀態：kubectl get pods -n kube-system -l k8s-app=metrics-server'
        );
      }

    } catch (error) {
      if (error.message.includes('not found')) {
        throw new Error(
          'metrics-server 未安裝。kubectl top 命令需要 metrics-server 才能工作。\n\n' +
          '安裝方法：\n' +
          '1. 使用官方 YAML：\n' +
          '   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml\n\n' +
          '2. 使用 Helm：\n' +
          '   helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/\n' +
          '   helm upgrade --install metrics-server metrics-server/metrics-server\n\n' +
          '3. 如果是本地開發環境（如 minikube、kind），可能需要添加 --kubelet-insecure-tls 參數'
        );
      }

      if (error.message.includes('未就緒')) {
        throw error;
      }

      throw new Error(`檢查 metrics-server 時發生錯誤: ${error.message}`);
    }
  }

  buildTopCommand(sortBy) {
    let command = ['top', 'nodes'];

    // 添加排序參數（kubectl top nodes 只支援 cpu 和 memory）
    if (sortBy) {
      switch (sortBy) {
        case 'cpu':
          command.push('--sort-by=cpu');
          break;
        case 'memory':
          command.push('--sort-by=memory');
          break;
      }
    }

    return command;
  }

  formatTopOutput(rawOutput) {
    const lines = rawOutput.trim().split('\n');

    if (lines.length < 2) {
      return '沒有找到節點資源使用資訊';
    }

    // 解析標題行
    const header = lines[0];
    const nodeLines = lines.slice(1);

    let formatted = `節點資源使用情況\n`;
    formatted += `==================================================\n\n`;
    formatted += `找到 ${nodeLines.length} 個節點的資源使用資訊：\n\n`;

    // 格式化表格
    formatted += `${header}\n`;
    formatted += `${'='.repeat(header.length)}\n`;

    nodeLines.forEach(line => {
      formatted += `${line}\n`;
    });

    formatted += `\n說明：\n`;
    formatted += `• CPU 使用量以 millicores (m) 為單位，1000m = 1 CPU core\n`;
    formatted += `• 記憶體使用量以 Mi (Mebibytes) 為單位\n`;
    formatted += `• 百分比顯示相對於節點總容量的使用率\n\n`;
    formatted += `提示：\n`;
    formatted += `• 使用 sortBy 參數可按 cpu 或 memory 排序\n`;
    formatted += `• 使用 kubectl_top_pods 查看 Pod 級別的資源使用情況`;

    return formatted;
  }
}