/**
 * 查看 Kubernetes Pod 資源使用情況
 * 需要 metrics-server 支援
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';

export class KubectlTopPodsTool extends BaseTool {
  constructor() {
    super('kubectl_top_pods', '查看 Kubernetes Pod 的 CPU 和記憶體使用情況（需要 metrics-server）');
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
            description: 'Kubernetes 命名空間（預設：default）'
          },
          allNamespaces: {
            type: 'boolean',
            description: '查看所有命名空間的 Pod（不能與 namespace 同時使用）'
          },
          sortBy: {
            type: 'string',
            description: '排序方式',
            enum: ['cpu', 'memory']
          },
          containers: {
            type: 'boolean',
            description: '顯示容器級別的資源使用情況'
          }
        },
        required: []
      }
    };
  }

  async execute(args) {
    try {
      this.validateInput(args);

      const { namespace = 'default', allNamespaces, sortBy, containers } = args;

      // 驗證參數組合
      this.validateParameterCombination(namespace, allNamespaces);

      // 檢查 metrics-server 是否安裝和運行
      await this.checkMetricsServer();

      // 構建 kubectl top pods 命令
      const command = this.buildTopCommand(namespace, allNamespaces, sortBy, containers);

      // 執行命令
      const result = await kubectl.execute(command);

      // 格式化輸出
      const formattedResult = this.formatTopOutput(result, allNamespaces, containers);

      this.logSuccess(args, formattedResult);
      return this.createResponse(formattedResult);

    } catch (error) {
      this.logError(args, error);

      // 檢查是否是 "沒有找到資源" 的情況
      if (error.message.includes('No resources found')) {
        const namespaceInfo = allNamespaces ? '所有命名空間中' : `命名空間 "${namespace}" 中`;
        return this.createResponse(`${namespaceInfo}沒有找到正在運行的 Pod。\n\n提示：\n• 確保指定的命名空間中有正在運行的 Pod\n• 使用 kubectl_get 查看 Pod 列表：{"resource": "pods", "namespace": "${namespace}"}\n• 如果是新叢集，可能需要先部署一些應用程式`);
      }

      return this.createErrorResponse(error.message);
    }
  }

  validateParameterCombination(namespace, allNamespaces) {
    if (namespace !== 'default' && allNamespaces) {
      throw new Error('不能同時指定 namespace 和 allNamespaces 參數');
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

  buildTopCommand(namespace, allNamespaces, sortBy, containers) {
    let command = ['top', 'pods'];

    // 添加命名空間參數
    if (allNamespaces) {
      command.push('--all-namespaces');
    } else {
      command.push('-n', namespace);
    }

    // 添加排序參數（kubectl top pods 只支援 cpu 和 memory）
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

    // 添加容器級別參數
    if (containers) {
      command.push('--containers');
    }

    return command;
  }

  formatTopOutput(rawOutput, allNamespaces, containers) {
    const lines = rawOutput.trim().split('\n');

    if (lines.length < 2) {
      return '沒有找到 Pod 資源使用資訊';
    }

    // 解析標題行
    const header = lines[0];
    const dataLines = lines.slice(1);

    let formatted = `Pod 資源使用情況\n`;
    formatted += `==================================================\n\n`;

    // 根據模式顯示不同的摘要
    if (containers) {
      formatted += `找到 ${dataLines.length} 個容器的資源使用資訊：\n\n`;
    } else {
      formatted += `找到 ${dataLines.length} 個 Pod 的資源使用資訊：\n\n`;
    }

    // 格式化表格
    formatted += `${header}\n`;
    formatted += `${'='.repeat(header.length)}\n`;

    dataLines.forEach(line => {
      formatted += `${line}\n`;
    });

    // 添加說明
    formatted += `\n說明：\n`;
    formatted += `• CPU 使用量以 millicores (m) 為單位，1000m = 1 CPU core\n`;
    formatted += `• 記憶體使用量以 Mi (Mebibytes) 為單位\n`;

    if (containers) {
      formatted += `• 顯示容器級別的詳細資源使用情況\n`;
      formatted += `• 格式：POD_NAME/CONTAINER_NAME\n`;
    } else {
      formatted += `• 顯示 Pod 級別的資源使用情況\n`;
    }

    if (allNamespaces) {
      formatted += `• 包含所有命名空間的 Pod\n`;
    }

    formatted += `\n提示：\n`;
    formatted += `• 使用 sortBy 參數可按 cpu 或 memory 排序\n`;
    formatted += `• 使用 containers=true 查看容器級別的資源使用情況\n`;
    formatted += `• 使用 allNamespaces=true 查看所有命名空間的 Pod\n`;
    formatted += `• 使用 kubectl_top_nodes 查看節點級別的資源使用情況`;

    return formatted;
  }
}