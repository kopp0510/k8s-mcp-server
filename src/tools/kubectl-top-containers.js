/**
 * 查看 Kubernetes 容器資源使用情況
 * 專注於容器級別的詳細監控和分析，需要 metrics-server 支援
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';

export class KubectlTopContainersTool extends BaseTool {
  constructor() {
    super('kubectl_top_containers', '查看 Kubernetes 容器的詳細 CPU 和記憶體使用情況（需要 metrics-server）');
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
            description: '查看所有命名空間的容器（不能與 namespace 同時使用）'
          },
          sortBy: {
            type: 'string',
            description: '排序方式',
            enum: ['cpu', 'memory']
          },
          podName: {
            type: 'string',
            description: '過濾特定 Pod 的容器'
          },
          containerName: {
            type: 'string',
            description: '過濾包含特定名稱的容器（模糊匹配）'
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
        namespace = 'default',
        allNamespaces,
        sortBy,
        podName,
        containerName
      } = args;

      // 驗證參數組合
      this.validateParameterCombination(namespace, allNamespaces);

      // 檢查 metrics-server 是否安裝和運行
      await this.checkMetricsServer();

      // 構建 kubectl top pods --containers 命令
      const command = this.buildTopCommand(namespace, allNamespaces, sortBy);

      // 執行命令
      const result = await kubectl.execute(command);

      // 解析和過濾容器資料
      const containerData = this.parseContainerData(result);
      const filteredData = this.filterContainerData(containerData, podName, containerName);

      // 格式化輸出
      const formattedResult = this.formatContainerOutput(filteredData, allNamespaces, args);

      this.logSuccess(args, formattedResult);
      return this.createResponse(formattedResult);

    } catch (error) {
      this.logError(args, error);

      // 檢查是否是 "沒有找到資源" 的情況
      if (error.message.includes('No resources found')) {
        const namespaceInfo = allNamespaces ? '所有命名空間中' : `命名空間 "${namespace}" 中`;
        return this.createResponse(`${namespaceInfo}沒有找到正在運行的容器。\n\n提示：\n• 確保指定的命名空間中有正在運行的 Pod\n• 使用 kubectl_get 查看 Pod 列表：{"resource": "pods", "namespace": "${namespace}"}\n• 如果是新叢集，可能需要先部署一些應用程式`);
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

  buildTopCommand(namespace, allNamespaces, sortBy) {
    let command = ['top', 'pods', '--containers'];

    // 添加命名空間參數
    if (allNamespaces) {
      command.push('--all-namespaces');
    } else {
      command.push('-n', namespace);
    }

    // 添加排序參數
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

  parseContainerData(rawOutput) {
    const lines = rawOutput.trim().split('\n');

    if (lines.length < 2) {
      return [];
    }

    const header = lines[0];
    const dataLines = lines.slice(1);

    // 判斷是否有 NAMESPACE 欄位
    const hasNamespace = header.includes('NAMESPACE');

    return dataLines.map(line => {
      const parts = line.trim().split(/\s+/);

      if (hasNamespace) {
        // 格式: NAMESPACE POD NAME CPU(cores) MEMORY(bytes)
        return {
          namespace: parts[0],
          pod: parts[1],
          container: parts[2],
          cpu: parts[3],
          memory: parts[4]
        };
      } else {
        // 格式: POD NAME CPU(cores) MEMORY(bytes)
        return {
          namespace: null,
          pod: parts[0],
          container: parts[1],
          cpu: parts[2],
          memory: parts[3]
        };
      }
    });
  }

  filterContainerData(containerData, podName, containerName) {
    let filtered = containerData;

    // 按 Pod 名稱過濾
    if (podName) {
      filtered = filtered.filter(container =>
        container.pod === podName
      );
    }

    // 按容器名稱過濾（模糊匹配）
    if (containerName) {
      filtered = filtered.filter(container =>
        container.container.toLowerCase().includes(containerName.toLowerCase())
      );
    }

    return filtered;
  }

  formatContainerOutput(containerData, allNamespaces, args) {
    if (containerData.length === 0) {
      const filters = [];
      if (args.podName) filters.push(`Pod: ${args.podName}`);
      if (args.containerName) filters.push(`容器名稱包含: ${args.containerName}`);

      const filterText = filters.length > 0 ? `（過濾條件：${filters.join(', ')}）` : '';
      return `沒有找到符合條件的容器資源使用資訊${filterText}`;
    }

    let formatted = `容器資源使用情況\n`;
    formatted += `==================================================\n\n`;

    // 統計資訊
    formatted += `找到 ${containerData.length} 個容器的資源使用資訊：\n`;

    // 計算統計資料
    const stats = this.calculateStats(containerData);
    formatted += `\n統計摘要：\n`;
    formatted += `• 總 CPU 使用量：${stats.totalCpu}m\n`;
    formatted += `• 總記憶體使用量：${stats.totalMemory}Mi\n`;
    formatted += `• 平均 CPU 使用量：${stats.avgCpu}m\n`;
    formatted += `• 平均記憶體使用量：${stats.avgMemory}Mi\n`;
    formatted += `• 涉及 Pod 數量：${stats.uniquePods}\n\n`;

    // 表格標題
    if (allNamespaces) {
      formatted += `NAMESPACE            POD                                      CONTAINER                CPU(cores)   MEMORY(bytes)\n`;
      formatted += `============================================================================================\n`;
    } else {
      formatted += `POD                                      CONTAINER                CPU(cores)   MEMORY(bytes)\n`;
      formatted += `===================================================================================\n`;
    }

    // 容器資料
    containerData.forEach(container => {
      if (allNamespaces) {
        formatted += `${container.namespace.padEnd(20)} ${container.pod.padEnd(40)} ${container.container.padEnd(20)} ${container.cpu.padEnd(12)} ${container.memory}\n`;
      } else {
        formatted += `${container.pod.padEnd(40)} ${container.container.padEnd(20)} ${container.cpu.padEnd(12)} ${container.memory}\n`;
      }
    });

    // 添加說明
    formatted += `\n說明：\n`;
    formatted += `• CPU 使用量以 millicores (m) 為單位，1000m = 1 CPU core\n`;
    formatted += `• 記憶體使用量以 Mi (Mebibytes) 為單位\n`;
    formatted += `• 每一行顯示一個容器的資源使用情況\n`;
    formatted += `• 格式：POD_NAME/CONTAINER_NAME\n`;

    if (allNamespaces) {
      formatted += `• 包含所有命名空間的容器\n`;
    }

    // 過濾條件說明
    if (args.podName || args.containerName) {
      formatted += `\n過濾條件：\n`;
      if (args.podName) formatted += `• Pod 名稱：${args.podName}\n`;
      if (args.containerName) formatted += `• 容器名稱包含：${args.containerName}\n`;
    }

    formatted += `\n提示：\n`;
    formatted += `• 使用 sortBy 參數可按 cpu 或 memory 排序\n`;
    formatted += `• 使用 podName 參數可過濾特定 Pod 的容器\n`;
    formatted += `• 使用 containerName 參數可過濾特定名稱的容器\n`;
    formatted += `• 使用 kubectl_top_pods 查看 Pod 級別的資源使用情況\n`;
    formatted += `• 使用 kubectl_top_nodes 查看節點級別的資源使用情況`;

    return formatted;
  }

  calculateStats(containerData) {
    const cpuValues = containerData.map(c => parseInt(c.cpu.replace('m', '')) || 0);
    const memoryValues = containerData.map(c => parseInt(c.memory.replace('Mi', '')) || 0);
    const uniquePods = new Set(containerData.map(c => c.pod)).size;

    return {
      totalCpu: cpuValues.reduce((sum, val) => sum + val, 0),
      totalMemory: memoryValues.reduce((sum, val) => sum + val, 0),
      avgCpu: Math.round(cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length || 0),
      avgMemory: Math.round(memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length || 0),
      uniquePods
    };
  }
}