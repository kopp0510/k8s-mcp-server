import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';

export class KubectlGetTool extends BaseTool {
  constructor() {
    super('kubectl_get', '取得 Kubernetes 資源 (pods, nodes, deployments, services, replicasets, daemonsets, statefulsets, jobs, cronjobs, configmaps, secrets, pv, pvc, ingress, hpa, namespaces, events)');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          resource: {
            type: 'string',
            description: '資源類型',
            enum: ['pods', 'nodes', 'deployments', 'services', 'replicasets', 'daemonsets', 'statefulsets', 'jobs', 'cronjobs', 'configmaps', 'secrets', 'pv', 'pvc', 'ingress', 'hpa', 'namespaces', 'events'],
          },
          namespace: {
            type: 'string',
            description: '命名空間 (適用於除了 nodes, pv 和 namespaces 以外的所有資源)',
          },
          allNamespaces: {
            type: 'boolean',
            description: '查看所有命名空間的資源 (等同於 kubectl -A 參數，不適用於 cluster-scoped 資源)',
            default: false,
          },
          name: {
            type: 'string',
            description: '特定資源名稱 (可選)',
          },
        },
        required: ['resource'],
      },
    };
  }

  async execute(args) {
    try {
      this.validateInput(args);

      const { resource, namespace, allNamespaces, name } = args;

      // 驗證資源類型
      const supportedResources = ['pods', 'nodes', 'deployments', 'services', 'replicasets', 'daemonsets', 'statefulsets', 'jobs', 'cronjobs', 'configmaps', 'secrets', 'pv', 'pvc', 'ingress', 'hpa', 'namespaces', 'events'];
      if (!supportedResources.includes(resource)) {
        throw new Error(`不支援的資源類型: ${resource}，僅支援 ${supportedResources.join(', ')}`);
      }

      // cluster-scoped 資源不支援 namespace 和 allNamespaces
      const clusterScopedResources = ['nodes', 'pv', 'namespaces'];
      if (clusterScopedResources.includes(resource)) {
        if (namespace) {
          throw new Error(`${resource} 資源不支援 namespace 參數（cluster-scoped 資源）`);
        }
        if (allNamespaces) {
          throw new Error(`${resource} 資源不支援 allNamespaces 參數（cluster-scoped 資源）`);
        }
      }

      // namespace 和 allNamespaces 不能同時使用
      if (namespace && allNamespaces) {
        throw new Error('namespace 和 allNamespaces 參數不能同時使用');
      }

      // 建構 kubectl 指令
      const kubectlArgs = ['get', resource];

      // 處理命名空間參數
      if (allNamespaces && !clusterScopedResources.includes(resource)) {
        kubectlArgs.push('-A');
      } else if (namespace && !clusterScopedResources.includes(resource)) {
        kubectlArgs.push('-n', namespace);
      }

      if (name) {
        kubectlArgs.push(name);
      }

      kubectlArgs.push('-o', 'json');

      // 執行指令
      const result = await kubectl.execute(kubectlArgs);

      // 解析 JSON 結果
      let jsonData;
      try {
        jsonData = JSON.parse(result);
      } catch (parseError) {
        throw new Error(`無法解析 kubectl 回應: ${parseError.message}`);
      }

      this.logSuccess(args, { content: [{ text: result }] });
      return this.createJsonResponse(jsonData);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(error.message);
    }
  }
}