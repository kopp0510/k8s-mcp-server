import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';

export class KubectlGetTool extends BaseTool {
  constructor() {
    super('kubectl_get', '取得 Kubernetes 資源 (pods, nodes, deployments, services, replicasets, daemonsets)');
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
            enum: ['pods', 'nodes', 'deployments', 'services', 'replicasets', 'daemonsets'],
          },
          namespace: {
            type: 'string',
            description: '命名空間 (適用於 pods, deployments, services, replicasets 和 daemonsets)',
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

      const { resource, namespace, name } = args;

      // 驗證資源類型
      if (!['pods', 'nodes', 'deployments', 'services', 'replicasets', 'daemonsets'].includes(resource)) {
        throw new Error(`不支援的資源類型: ${resource}，僅支援 pods, nodes, deployments, services, replicasets 和 daemonsets`);
      }

      // nodes 不支援 namespace
      if (resource === 'nodes' && namespace) {
        throw new Error('nodes 資源不支援 namespace 參數');
      }

      // 建構 kubectl 指令
      const kubectlArgs = ['get', resource];

      // pods, deployments, services, replicasets 和 daemonsets 支援 namespace
      if (namespace && (resource === 'pods' || resource === 'deployments' || resource === 'services' || resource === 'replicasets' || resource === 'daemonsets')) {
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