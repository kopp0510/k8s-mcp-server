import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';
import { validator } from '../utils/validator.js';

export class KubectlGetTool extends BaseTool {
  constructor() {
    super('kubectl_get', '取得 Kubernetes 資源 (pods, nodes, deployments, services, replicasets, daemonsets, statefulsets, jobs, cronjobs, configmaps, secrets, pv, pvc, ingress, hpa, namespaces, events, serviceaccounts, clusterroles, clusterrolebindings)，支援標籤選擇器篩選');
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
            enum: ['pods', 'nodes', 'deployments', 'services', 'replicasets', 'daemonsets', 'statefulsets', 'jobs', 'cronjobs', 'configmaps', 'secrets', 'pv', 'pvc', 'ingress', 'hpa', 'namespaces', 'events', 'serviceaccounts', 'clusterroles', 'clusterrolebindings'],
          },
          namespace: {
            type: 'string',
            description: '命名空間 (適用於除了 nodes, pv, namespaces, clusterroles, clusterrolebindings 以外的所有資源)',
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
          labelSelector: {
            type: 'string',
            description: '標籤選擇器 (例如: "app=nginx", "environment=prod,tier=frontend", "app!=test")',
          },
          labels: {
            type: 'object',
            description: '標籤鍵值對物件 (例如: {"app": "nginx", "environment": "prod"})',
          },
        },
        required: ['resource'],
      },
    };
  }

    /**
   * 驗證標籤選擇器格式（使用共用驗證器）
   */
  validateLabelSelector(labelSelector) {
    validator.validateLabelSelector(labelSelector);
  }

  /**
   * 驗證標籤物件（使用共用驗證器）
   */
  validateLabels(labels) {
    validator.validateLabelsObject(labels);
  }

  /**
   * 將標籤物件轉換為標籤選擇器字串
   */
  convertLabelsToSelector(labels) {
    const selectors = [];
    for (const [key, value] of Object.entries(labels)) {
      if (value === '') {
        selectors.push(key);  // 僅檢查鍵存在
      } else {
        selectors.push(`${key}=${value}`);
      }
    }
    return selectors.join(',');
  }

  async execute(args) {
    try {
      this.validateInput(args);

      const { resource, namespace, allNamespaces, name, labelSelector, labels } = args;

      // 驗證資源類型
      const supportedResources = ['pods', 'nodes', 'deployments', 'services', 'replicasets', 'daemonsets', 'statefulsets', 'jobs', 'cronjobs', 'configmaps', 'secrets', 'pv', 'pvc', 'ingress', 'hpa', 'namespaces', 'events', 'serviceaccounts', 'clusterroles', 'clusterrolebindings'];
      if (!supportedResources.includes(resource)) {
        throw new Error(`不支援的資源類型: ${resource}，僅支援 ${supportedResources.join(', ')}`);
      }

      // cluster-scoped 資源不支援 namespace 和 allNamespaces
      const clusterScopedResources = ['nodes', 'pv', 'namespaces', 'clusterroles', 'clusterrolebindings'];
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

      // labelSelector 和 labels 不能同時使用
      if (labelSelector && labels) {
        throw new Error('labelSelector 和 labels 參數不能同時使用，請選擇其中一種方式');
      }

      // 驗證標籤參數
      let finalLabelSelector = null;
      if (labelSelector) {
        this.validateLabelSelector(labelSelector);
        finalLabelSelector = labelSelector;
      } else if (labels) {
        this.validateLabels(labels);
        finalLabelSelector = this.convertLabelsToSelector(labels);
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

      // 加入標籤選擇器
      if (finalLabelSelector) {
        kubectlArgs.push('-l', finalLabelSelector);
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

      // 記錄成功執行的詳細資訊
      const logDetails = {
        resource,
        namespace: namespace || 'default',
        allNamespaces,
        name,
        labelSelector: finalLabelSelector,
        itemCount: jsonData.items ? jsonData.items.length : (jsonData.kind ? 1 : 0)
      };

      this.logSuccess(args, { content: [{ text: `找到 ${logDetails.itemCount} 個資源` }] });
      return this.createJsonResponse(jsonData);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(error.message);
    }
  }
}