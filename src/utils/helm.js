import { spawn } from 'child_process';
import { logger } from './logger.js';
import { clusterManager } from './cluster-manager.js';

export class HelmRunner {
  constructor() {
    this.timeout = 60000; // 60 second timeout (Helm operations usually slower than kubectl)
  }

  /**
   * 加入叢集 context 和 kubeconfig 參數到 helm 指令
   * @param {Array} args - helm 參數陣列
   * @param {string} clusterId - 叢集 ID (可選)
   * @returns {Array} 更新後的參數陣列
   */
  addClusterContext(args, clusterId) {
    if (!clusterId) {
      return args;
    }

    // 如果已經有 --kube-context 或 --kubeconfig 參數，不重複加入
    if (args.includes('--kube-context') || args.includes('--kubeconfig')) {
      return args;
    }

    try {
      // 從 cluster manager 取得叢集配置
      const cluster = clusterManager.getCluster(clusterId);

      let finalArgs = [...args];

      if (cluster.type === 'local') {
        // Local 類型叢集：同時添加 context 和 kubeconfig 參數
        if (cluster.context) {
          finalArgs = ['--kube-context', cluster.context, ...finalArgs];
        }
        if (cluster.kubeconfig) {
          finalArgs = ['--kubeconfig', cluster.kubeconfig, ...finalArgs];
        }
      } else if (cluster.type === 'gke') {
        // GKE 類型叢集：只使用 context（kubeconfig 由 gcloud 管理）
        const contextName = `gke_${cluster.project}_${cluster.region}_${cluster.cluster}`;
        finalArgs = ['--kube-context', contextName, ...finalArgs];
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
      throw new Error('helm arguments must be a non-empty array');
    }

    // 加入叢集 context 和 kubeconfig 參數
    const finalArgs = this.addClusterContext(args, cluster);

    // Build command
    const command = `helm ${finalArgs.join(' ')}`;

    logger.debug(`Executing helm: ${command}`);

    return new Promise((resolve, reject) => {
      const helm = spawn('helm', finalArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      helm.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      helm.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      helm.on('close', (code) => {
        if (stderr && !stdout) {
          logger.warn(`helm warning: ${stderr}`);
        }

        if (code === 0) {
          resolve(stdout.trim());
        } else {
          logger.error(`helm execution failed: ${command}`, { code, stderr });

          // Handle common errors
          if (stderr.includes('timeout')) {
            reject(new Error('helm command execution timeout'));
          } else if (stderr.includes('not found')) {
            reject(new Error(`Resource not found: ${stderr.trim()}`));
          } else if (stderr.includes('connection refused')) {
            reject(new Error(`Unable to connect to cluster: ${stderr.trim()}`));
          } else {
            reject(new Error(`helm execution failed: ${stderr.trim() || `Exit code: ${code}`}`));
          }
        }
      });

      helm.on('error', (error) => {
        logger.error(`helm execution failed: ${command}`, error);
        reject(new Error(`helm execution failed: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        helm.kill('SIGTERM');
        reject(new Error('helm command timeout'));
      }, this.timeout);
    });
  }
}

export const helm = new HelmRunner();