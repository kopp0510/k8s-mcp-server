/**
 * 取得 Kubernetes 資源的 YAML 格式輸出
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';

export class KubectlGetYamlTool extends BaseTool {
  constructor() {
    super('kubectl_get_yaml', '取得 Kubernetes 資源的 YAML 格式輸出，用於檢查配置、備份或調試');
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
            description: '要取得的資源類型',
            enum: [
              'pods', 'nodes', 'deployments', 'services', 'replicasets',
              'daemonsets', 'statefulsets', 'jobs', 'cronjobs',
              'configmaps', 'secrets', 'pv', 'pvc', 'ingress', 'hpa',
              'namespaces', 'events', 'serviceaccounts', 'clusterroles', 'clusterrolebindings'
            ]
          },
          name: {
            type: 'string',
            description: '資源名稱（可選，如果不提供則取得所有資源）'
          },
          namespace: {
            type: 'string',
            description: '命名空間（僅適用於 namespace-scoped 資源）'
          },
          allNamespaces: {
            type: 'boolean',
            description: '是否查看所有命名空間的資源'
          }
        },
        required: ['resource']
      }
    };
  }

  async execute(args) {
    try {
      this.validateInput(args);

      const { resource, name, namespace, allNamespaces } = args;

      // 驗證參數組合
      this.validateParameterCombination(resource, namespace, allNamespaces);

      // 構建 kubectl 命令
      const command = this.buildKubectlCommand(resource, name, namespace, allNamespaces);

      // 執行命令
      const result = await kubectl.execute(command);

      this.logSuccess(args, result);
      return this.createResponse(result);

    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(error.message);
    }
  }

  validateParameterCombination(resource, namespace, allNamespaces) {
    // namespace 和 allNamespaces 不能同時使用
    if (namespace && allNamespaces) {
      throw new Error('不能同時指定 namespace 和 allNamespaces 參數');
    }

    // cluster-scoped 資源不支援 namespace 相關參數
    const clusterScopedResources = ['nodes', 'pv', 'namespaces', 'clusterroles', 'clusterrolebindings'];
    if (clusterScopedResources.includes(resource)) {
      if (namespace) {
        throw new Error(`${resource} 是 cluster-scoped 資源，不支援 namespace 參數`);
      }
      if (allNamespaces) {
        throw new Error(`${resource} 是 cluster-scoped 資源，不支援 allNamespaces 參數`);
      }
    }
  }

  buildKubectlCommand(resource, name, namespace, allNamespaces) {
    let command = ['get', resource];

    // 添加資源名稱
    if (name) {
      command.push(name);
    }

    // 添加輸出格式
    command.push('-o', 'yaml');

    // 添加命名空間參數
    if (namespace) {
      command.push('--namespace', namespace);
    } else if (allNamespaces) {
      command.push('--all-namespaces');
    }

    return command;
  }
}