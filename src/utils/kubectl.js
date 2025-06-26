import { spawn } from 'child_process';
import { logger } from './logger.js';
import { clusterManager } from './cluster-manager.js';

export class KubectlRunner {
  constructor() {
    this.timeout = 30000; // 30 second timeout
  }

  /**
   * 加入叢集 context 和 kubeconfig 參數到 kubectl 指令
   * @param {Array} args - kubectl 參數陣列
   * @param {string} clusterId - 叢集 ID (可選)
   * @returns {Array} 更新後的參數陣列
   */
  addClusterContext(args, clusterId) {
    if (!clusterId) {
      return args;
    }

    // 如果已經有 --context 或 --kubeconfig 參數，不重複加入
    if (args.includes('--context') || args.includes('--kubeconfig')) {
      return args;
    }

    try {
      // 從 cluster manager 取得叢集配置
      const cluster = clusterManager.getCluster(clusterId);

      let finalArgs = [...args];

      if (cluster.type === 'local') {
        // Local 類型叢集：同時添加 context 和 kubeconfig 參數
        if (cluster.context) {
          finalArgs = ['--context', cluster.context, ...finalArgs];
        }
        if (cluster.kubeconfig) {
          finalArgs = ['--kubeconfig', cluster.kubeconfig, ...finalArgs];
        }
      } else if (cluster.type === 'gke') {
        // GKE 類型叢集：只使用 context（kubeconfig 由 gcloud 管理）
        const contextName = `gke_${cluster.project}_${cluster.region}_${cluster.cluster}`;
        finalArgs = ['--context', contextName, ...finalArgs];
      }

      return finalArgs;
    } catch (error) {
      logger.error(`Failed to get cluster config for ${clusterId}: ${error.message}`);
      // 如果取得叢集配置失敗，應該停止執行而不是繼續
      throw new Error(`Invalid cluster configuration for '${clusterId}': ${error.message}`);
    }
  }

  async execute(args, cluster = null) {
    // Validate parameters
    if (!Array.isArray(args) || args.length === 0) {
      throw new Error('kubectl arguments must be a non-empty array');
    }

    // 加入叢集 context 和 kubeconfig 參數
    const finalArgs = this.addClusterContext(args, cluster);

    // Build command
    const command = `kubectl ${finalArgs.join(' ')}`;

    logger.debug(`Executing kubectl: ${command}`);

    return new Promise((resolve, reject) => {
      const kubectl = spawn('kubectl', finalArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      kubectl.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      kubectl.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      kubectl.on('close', (code) => {
        if (stderr && !stdout) {
          logger.warn(`kubectl warning: ${stderr}`);
        }

        if (code === 0) {
          resolve(stdout.trim());
        } else {
          logger.error(`kubectl execution failed: ${command}`, { code, stderr });

          // Handle common errors
          if (stderr.includes('timeout')) {
            reject(new Error('kubectl command execution timeout'));
          } else if (stderr.includes('not found')) {
            reject(new Error(`Resource not found: ${stderr.trim()}`));
          } else if (stderr.includes('connection refused')) {
            reject(new Error(`Unable to connect to cluster: ${stderr.trim()}`));
          } else {
            reject(new Error(`kubectl execution failed: ${stderr.trim() || `Exit code: ${code}`}`));
          }
        }
      });

      kubectl.on('error', (error) => {
        logger.error(`kubectl execution failed: ${command}`, error);
        reject(new Error(`kubectl execution failed: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        kubectl.kill('SIGTERM');
        reject(new Error('kubectl command timeout'));
      }, this.timeout);
    });
  }
}

export const kubectl = new KubectlRunner();