import { spawn } from 'child_process';
import { logger } from './logger.js';
import { clusterManager } from './cluster-manager.js';

export class HelmRunner {
  constructor() {
    this.timeout = 60000; // 60 second timeout (Helm operations usually slower than kubectl)
  }

  /**
   * Add cluster context and kubeconfig parameters to helm command
   * @param {Array} args - helm parameter array
   * @param {string} clusterId - cluster ID (optional)
   * @returns {Array} updated parameter array
   */
  addClusterContext(args, clusterId) {
    if (!clusterId) {
      return args;
    }

    // If already has --kube-context or --kubeconfig parameters, do not repeat
    if (args.includes('--kube-context') || args.includes('--kubeconfig')) {
      return args;
    }

    try {
      // Get cluster configuration from cluster manager
      const cluster = clusterManager.getCluster(clusterId);

      let finalArgs = [...args];

      if (cluster.type === 'local') {
        // Local type cluster: add context and kubeconfig parameters at the same time
        if (cluster.context) {
          finalArgs = ['--kube-context', cluster.context, ...finalArgs];
        }
        if (cluster.kubeconfig) {
          finalArgs = ['--kubeconfig', cluster.kubeconfig, ...finalArgs];
        }
      } else if (cluster.type === 'gke') {
        // GKE type cluster: only use context (kubeconfig managed by gcloud)
        const contextName = `gke_${cluster.project}_${cluster.region}_${cluster.cluster}`;
        finalArgs = ['--kube-context', contextName, ...finalArgs];
      }

      return finalArgs;
    } catch (error) {
      logger.error(`Cluster configuration retrieval failed: ${clusterId}`, {
        clusterId,
        error: error.message,
        action: 'ABORT_HELM_EXECUTION'
      });
      // If cluster configuration retrieval fails, execution should stop instead of continuing
      throw new Error(`Invalid cluster configuration '${clusterId}': ${error.message}`);
    }
  }

  async execute(args, cluster = null) {
    // Validate parameters
    if (!Array.isArray(args) || args.length === 0) {
      throw new Error('helm arguments must be a non-empty array');
    }

    // Add cluster context and kubeconfig parameters
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