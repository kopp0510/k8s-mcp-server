/**
 * Cluster List Tool
 * 列出所有可用的 Kubernetes 叢集
 */

import { BaseTool } from './base-tool.js';
import { clusterManager } from '../utils/cluster-manager.js';

export class ClusterListTool extends BaseTool {
  constructor() {
    super('cluster_list', 'List all available Kubernetes clusters with their configurations and status');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['table', 'detailed', 'json'],
            description: 'Output format (default: detailed)',
            default: 'detailed'
          },
          includeStats: {
            type: 'boolean',
            description: 'Include cluster manager statistics',
            default: false
          }
        },
        required: []
      }
    };
  }

  async execute(args) {
    try {
      const { format = 'detailed', includeStats = false } = args;

      // 驗證輸入
      this.validateInput(args);

      const clusters = clusterManager.getClusters();
      const defaultCluster = clusterManager.clusters.default;
      const currentCluster = clusterManager.getCurrentCluster();
      const stats = includeStats ? clusterManager.getStats() : null;

      let result;

      switch (format) {
        case 'json':
          result = this.formatJsonOutput(clusters, defaultCluster, currentCluster, stats);
          break;
        case 'table':
          result = this.formatTableOutput(clusters, defaultCluster, currentCluster, stats);
          break;
        case 'detailed':
        default:
          result = this.formatDetailedOutput(clusters, defaultCluster, currentCluster, stats);
          break;
      }

      this.logSuccess(args, { clustersCount: Object.keys(clusters).length });

      if (format === 'json') {
        return {
          content: [
            {
              type: 'json',
              json: result
            }
          ]
        };
      } else {
        return this.createResponse(result);
      }

    } catch (error) {
      this.logError(error, args);
      return this.createErrorResponse(error.message);
    }
  }

  /**
   * 格式化詳細輸出
   */
  formatDetailedOutput(clusters, defaultCluster, currentCluster, stats) {
    let result = 'Available Kubernetes Clusters\n';
    result += '='.repeat(50) + '\n\n';

    // 叢集列表
    for (const [id, cluster] of Object.entries(clusters)) {
      const isDefault = id === defaultCluster;
      const isCurrent = id === currentCluster;

      let status = '';
      if (isCurrent && isDefault) {
        status = ' (Current & Default)';
      } else if (isCurrent) {
        status = ' (Current)';
      } else if (isDefault) {
        status = ' (Default)';
      }

      result += `**${cluster.name}**${status}\n`;
      result += `  ID: ${id}\n`;
      result += `  Type: ${cluster.type.toUpperCase()}\n`;
      result += `  Description: ${cluster.description}\n`;

      if (cluster.type === 'gke') {
        result += `  Project: ${cluster.project}\n`;
        result += `  Cluster: ${cluster.cluster}\n`;
        result += `  Region: ${cluster.region}\n`;
        result += `  Key File: ${cluster.keyFile}\n`;
      } else if (cluster.type === 'local') {
        result += `  Kubeconfig: ${cluster.kubeconfig}\n`;
        if (cluster.context) {
          result += `  Context: ${cluster.context}\n`;
        }
      }

      result += '\n';
    }

    // 統計資訊
    if (stats) {
      result += this.formatStatsSection(stats);
    }

    // 使用說明
    result += `**Usage Guidelines:**\n`;
    result += `• All kubectl and helm tools support optional 'cluster' parameter\n`;
    result += `• For GKE clusters, authentication happens automatically when switching\n`;
    result += `• Local clusters use the mounted kubeconfig file\n`;
    result += `• Use gke_auth tool for manual GKE authentication if needed\n\n`;

    result += `**Examples:**\n`;
    result += `• List pods in default cluster: {"resource": "pods"}\n`;
    result += `• List pods in specific cluster: {"resource": "pods", "cluster": "${Object.keys(clusters)[0]}"}\n`;
    result += `• Switch and list: Use gke_auth first, then kubectl operations\n\n`;

    result += `**Available Tools:**\n`;
    result += `• cluster_list - List available clusters (this tool)\n`;
    result += `• gke_auth - Authenticate to GKE cluster\n`;
    result += `• All kubectl_* tools support cluster parameter\n`;
    result += `• All helm_* tools support cluster parameter\n`;

    return result;
  }

  /**
   * 格式化表格輸出
   */
  formatTableOutput(clusters, defaultCluster, currentCluster, stats) {
    let result = 'Kubernetes Clusters Summary\n';
    result += '='.repeat(50) + '\n\n';

    // 表格標題
    result += 'ID'.padEnd(20) + 'Name'.padEnd(25) + 'Type'.padEnd(8) + 'Status\n';
    result += '-'.repeat(20) + '-'.repeat(25) + '-'.repeat(8) + '-'.repeat(15) + '\n';

    // 表格內容
    for (const [id, cluster] of Object.entries(clusters)) {
      const isDefault = id === defaultCluster;
      const isCurrent = id === currentCluster;

      let status = '';
      if (isCurrent && isDefault) {
        status = 'Current+Default';
      } else if (isCurrent) {
        status = 'Current';
      } else if (isDefault) {
        status = 'Default';
      } else {
        status = '-';
      }

      result += id.padEnd(20) +
                cluster.name.substring(0, 24).padEnd(25) +
                cluster.type.toUpperCase().padEnd(8) +
                status + '\n';
    }

    result += '\n';

    // 統計資訊
    if (stats) {
      result += this.formatStatsSection(stats);
    }

    result += `**Quick Reference:**\n`;
    result += `• Total clusters: ${Object.keys(clusters).length}\n`;
    result += `• Default: ${defaultCluster}\n`;
    result += `• Current: ${currentCluster}\n`;
    result += `• Use cluster parameter in kubectl/helm tools to specify target\n`;

    return result;
  }

  /**
   * 格式化 JSON 輸出
   */
  formatJsonOutput(clusters, defaultCluster, currentCluster, stats) {
    const result = {
      clusters: {},
      metadata: {
        default: defaultCluster,
        current: currentCluster,
        total: Object.keys(clusters).length
      }
    };

    // 處理叢集資訊
    for (const [id, cluster] of Object.entries(clusters)) {
      result.clusters[id] = {
        ...cluster,
        id,
        isDefault: id === defaultCluster,
        isCurrent: id === currentCluster
      };
    }

    // 加入統計資訊
    if (stats) {
      result.stats = stats;
    }

    return result;
  }

  /**
   * 格式化統計資訊區塊
   */
  formatStatsSection(stats) {
    let result = `**Cluster Manager Statistics:**\n`;
    result += `• Total clusters: ${stats.total}\n`;
    result += `• Types: ${Object.entries(stats.types).map(([type, count]) => `${type}(${count})`).join(', ')}\n`;
    result += `• Default cluster: ${stats.default}\n`;
    result += `• Current cluster: ${stats.current}\n`;
    result += `• Configuration file: ${stats.configPath}\n\n`;
    return result;
  }

  /**
   * 驗證輸入參數
   */
  validateInput(args) {
    if (args.format && !['table', 'detailed', 'json'].includes(args.format)) {
      throw new Error('Invalid format. Must be one of: table, detailed, json');
    }

    if (args.includeStats && typeof args.includeStats !== 'boolean') {
      throw new Error('includeStats must be a boolean value');
    }
  }
}