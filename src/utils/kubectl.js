import { spawn } from 'child_process';
import { logger } from './logger.js';
import { clusterManager } from './cluster-manager.js';

export class KubectlRunner {
  constructor() {
    this.timeout = 30000; // 30 second timeout
  }

  /**
   * Add cluster context and kubeconfig parameters to kubectl command
   * @param {Array} args - kubectl parameter array
   * @param {string} clusterId - cluster ID (optional)
   * @returns {Array} updated parameter array
   */
  addClusterContext(args, clusterId) {
    if (!clusterId) {
      return args;
    }

    // If already has --context or --kubeconfig parameters, do not repeat
    if (args.includes('--context') || args.includes('--kubeconfig')) {
      return args;
    }

    try {
      // Get cluster configuration from cluster manager
      const cluster = clusterManager.getCluster(clusterId);

      let finalArgs = [...args];

      if (cluster.type === 'local') {
        // Local type cluster: add context and kubeconfig parameters
        if (cluster.context) {
          finalArgs = ['--context', cluster.context, ...finalArgs];
        }
        if (cluster.kubeconfig) {
          finalArgs = ['--kubeconfig', cluster.kubeconfig, ...finalArgs];
        }
      } else if (cluster.type === 'gke') {
        // GKE type cluster: use context only (kubeconfig managed by gcloud)
        const contextName = `gke_${cluster.project}_${cluster.region}_${cluster.cluster}`;
        finalArgs = ['--context', contextName, ...finalArgs];
      }

      return finalArgs;
    } catch (error) {
      logger.error(`Cluster configuration retrieval failed: ${clusterId}`, {
        clusterId,
        error: error.message,
        action: 'ABORT_KUBECTL_EXECUTION'
      });
      // If cluster configuration retrieval fails, execution should stop instead of continuing
      throw new Error(`Invalid cluster configuration '${clusterId}': ${error.message}`);
    }
  }

  async execute(args, cluster = null) {
    // Validate parameters
    if (!Array.isArray(args) || args.length === 0) {
      throw new Error('kubectl arguments must be a non-empty array');
    }

    // Add cluster context and kubeconfig parameters
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