/**
 * Cluster Manager - Multi-Cluster Management Tool
 * Responsible for loading cluster configuration, GKE authentication, and cluster switching
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { logger } from './logger.js';

export class ClusterManager {
  constructor() {
    this.configPath = fs.existsSync('/app/config/clusters.json')
      ? '/app/config/clusters.json'
      : path.join(process.cwd(), 'src/config/clusters.json');
    this.clusters = null;
    this.currentCluster = null;
    this.loadClusters();
  }

  /**
   * Load cluster configuration file
   */
  loadClusters() {
    try {
      if (!fs.existsSync(this.configPath)) {
        logger.warn(`Cluster configuration file not found: ${this.configPath}`);
        // Create default configuration
        this.clusters = this.getDefaultConfig();
        return;
      }

      const data = fs.readFileSync(this.configPath, 'utf8');
      this.clusters = JSON.parse(data);

      // Validate configuration file structure
      this.validateConfig();

      logger.info('Cluster configuration loaded successfully', {
        clustersCount: Object.keys(this.clusters.clusters).length,
        defaultCluster: this.clusters.default
      });
    } catch (error) {
      logger.error('Failed to load cluster configuration', error);
      throw new Error(`Unable to load cluster configuration: ${error.message}`);
    }
  }

  /**
   * Validate configuration file structure
   */
  validateConfig() {
    if (!this.clusters.clusters || typeof this.clusters.clusters !== 'object') {
      throw new Error('Invalid configuration: missing clusters object');
    }

    if (!this.clusters.default || !this.clusters.clusters[this.clusters.default]) {
      throw new Error(`Invalid configuration: default cluster '${this.clusters.default}' not found`);
    }

    // Validate each cluster configuration
    for (const [id, cluster] of Object.entries(this.clusters.clusters)) {
      this.validateClusterConfig(id, cluster);
    }
  }

  /**
   * Validate single cluster configuration
   */
  validateClusterConfig(id, cluster) {
    const required = ['name', 'type', 'description'];
    for (const field of required) {
      if (!cluster[field]) {
        throw new Error(`Cluster '${id}' missing required field: ${field}`);
      }
    }

    if (cluster.type === 'gke') {
      const gkeRequired = ['project', 'cluster', 'region', 'keyFile'];
      for (const field of gkeRequired) {
        if (!cluster[field]) {
          throw new Error(`GKE cluster '${id}' missing required field: ${field}`);
        }
      }
    } else if (cluster.type === 'local') {
      if (!cluster.kubeconfig) {
        throw new Error(`Local cluster '${id}' missing required field: kubeconfig`);
      }
    } else {
      throw new Error(`Cluster '${id}' has unsupported type: ${cluster.type}`);
    }
  }

  /**
   * Get default configuration (when configuration file does not exist)
   */
  getDefaultConfig() {
    return {
      clusters: {
        local: {
          name: "Local Kubernetes",
          type: "local",
          description: "Local Kubernetes cluster",
          kubeconfig: "/home/nodejs/.kube/config"
        }
      },
      default: "local",
      configuration: {
        gke_auth_timeout: 300,
        kubectl_timeout: 30,
        helm_timeout: 60,
        auto_refresh_credentials: true
      }
    };
  }

  /**
   * Get all clusters
   */
  getClusters() {
    return this.clusters.clusters;
  }

  /**
   * Get specific cluster configuration
   */
  getCluster(clusterName) {
    if (!clusterName) {
      clusterName = this.clusters.default;
    }

    const cluster = this.clusters.clusters[clusterName];
    if (!cluster) {
      throw new Error(`Cluster '${clusterName}' not found`);
    }

    return { ...cluster, id: clusterName };
  }

  /**
   * Get available cluster list
   */
  getAvailableClusters() {
    const clusters = this.getClusters();
    return Object.keys(clusters).map(id => ({
      id,
      ...clusters[id]
    }));
  }

  /**
   * Get default cluster
   */
  getDefaultCluster() {
    return this.getCluster(this.clusters.default);
  }

  /**
   * Check if cluster exists
   */
  clusterExists(clusterName) {
    return !!this.clusters.clusters[clusterName];
  }

  /**
   * GKE cluster authentication
   */
  async authenticateGKE(cluster) {
    if (cluster.type !== 'gke') {
      return;
    }

    // Declare kubeconfigPath only once for this function
    const kubeconfigPath = '/home/nodejs/.kube/config';

    logger.info(`Starting GKE authentication for cluster: ${cluster.name}`, {
      project: cluster.project,
      cluster: cluster.cluster,
      region: cluster.region
    });

    try {
      // Check if service account key file exists
      if (!fs.existsSync(cluster.keyFile)) {
        throw new Error(`Service account key file not found: ${cluster.keyFile}`);
      }

      // 1. Service account authentication
      logger.debug('Activating service account');
      await this.executeCommand('gcloud', [
        'auth', 'activate-service-account',
        '--key-file', cluster.keyFile,
        '--quiet'
      ]);

      // 2. Get cluster credentials
      logger.debug('Getting cluster credentials');
      await this.executeCommand('gcloud', [
        'container', 'clusters', 'get-credentials',
        cluster.cluster,
        '--region', cluster.region,
        '--project', cluster.project,
        '--quiet'
      ]);

      // 3. Switch to GKE context
      const contextName = `gke_${cluster.project}_${cluster.region}_${cluster.cluster}`;
      logger.debug(`Switching to GKE context: ${contextName}`);
      await this.executeCommand('kubectl', [
        'config', 'use-context', contextName,
        '--kubeconfig', kubeconfigPath
      ]);

      // 4. Verify kubeconfig state and connection
      logger.debug('Checking kubeconfig state and verifying connection');
      try {
        // Check current context
        const currentContext = await this.executeCommand('kubectl', ['config', 'current-context', '--kubeconfig', kubeconfigPath]);
        logger.debug(`Current kubectl context: ${currentContext}`);

        // Check all available contexts
        const allContexts = await this.executeCommand('kubectl', ['config', 'get-contexts', '--no-headers', '--kubeconfig', kubeconfigPath]);
        logger.debug(`Available contexts:\n${allContexts}`);

        // Verify connection
        await this.executeCommand('kubectl', ['cluster-info', '--request-timeout=10s', '--kubeconfig', kubeconfigPath]);
        logger.debug('Cluster connection verified successfully');
      } catch (verifyError) {
        logger.warn(`Verification failed: ${verifyError.message}`);
        throw verifyError;
      }

      this.currentCluster = cluster.id;

      // Add a small delay to ensure kubeconfig file operations are fully completed
      // This prevents concurrent access issues when multiple kubectl commands run immediately after authentication
      logger.debug('Waiting for kubeconfig file operations to stabilize');
      await new Promise(resolve => setTimeout(resolve, 500));

      logger.info(`Successfully authenticated GKE cluster: ${cluster.name}`, {
        project: cluster.project,
        cluster: cluster.cluster,
        region: cluster.region
      });

    } catch (error) {
      logger.error(`GKE authentication failed for cluster: ${cluster.name}`, {
        error: error.message,
        project: cluster.project,
        cluster: cluster.cluster
      });
      throw new Error(`GKE authentication failed: ${error.message}`);
    }
  }

  /**
   * Switch to specified cluster
   */
  async switchToCluster(clusterName) {
    const cluster = this.getCluster(clusterName);

    logger.info(`Switching to cluster: ${cluster.name}`, {
      id: clusterName,
      type: cluster.type
    });

    try {
      if (cluster.type === 'gke') {
        await this.authenticateGKE(cluster);
      } else if (cluster.type === 'local') {
        // For local type, check if kubeconfig exists
        if (!fs.existsSync(cluster.kubeconfig)) {
          throw new Error(`Kubeconfig file not found: ${cluster.kubeconfig}`);
        }

        // If specified context, switch to that context
        if (cluster.context) {
          await this.executeCommand('kubectl', [
            'config', 'use-context', cluster.context,
            '--kubeconfig', cluster.kubeconfig
          ]);
        }

        this.currentCluster = clusterName;
      }

      logger.info(`Successfully switched to cluster: ${cluster.name}`);
      return cluster;

    } catch (error) {
      logger.error(`Failed to switch to cluster: ${cluster.name}`, error);
      throw error;
    }
  }

  /**
   * Get currently used cluster
   */
  getCurrentCluster() {
    return this.currentCluster || this.clusters.default;
  }

  /**
   * Execute system command
   */
  async executeCommand(command, args, options = {}) {
    const timeout = options.timeout || this.clusters.configuration?.gke_auth_timeout || 300;

    return new Promise((resolve, reject) => {
      logger.debug(`Executing command: ${command} ${args.join(' ')}`);

      const childProcess = spawn(command, args, {
        stdio: 'pipe',
        env: {
          ...process.env,
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
          USE_GKE_GCLOUD_AUTH_PLUGIN: 'True'
        },
        ...options
      });

      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code, signal) => {
        if (isTimedOut) {
          return; // Already handled by timeout
        }

        if (code === 0) {
          resolve(stdout.trim());
        } else {
          let error;
          if (code === null || signal) {
            // Process was terminated by signal
            error = `Process terminated by signal (${signal || 'unknown'}). stderr: ${stderr.trim() || 'No error output'}`;
            logger.error(`Process terminated by signal: ${command}`, {
              args: args.join(' '),
              signal: signal || 'unknown',
              code: 'SIGNAL_TERMINATED',
              stderr: stderr.trim(),
              stdout: stdout.trim()
            });
          } else {
            error = stderr.trim() || `Command failed with code ${code}`;
            logger.error(`Command execution failed: ${command}`, {
              args: args.join(' '),
              code,
              stderr: error
            });
          }
          reject(new Error(error));
        }
      });

      childProcess.on('error', (error) => {
        if (isTimedOut) {
          return; // Already handled by timeout
        }
        logger.error(`Command execution error: ${command}`, {
          error: error.message,
          args: args.join(' ')
        });
        reject(error);
      });

      // Set timeout
      const timer = setTimeout(() => {
        isTimedOut = true;
        childProcess.kill('SIGTERM');

        // If SIGTERM doesn't work, try SIGKILL after a short delay
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill('SIGKILL');
          }
        }, 1000);

        reject(new Error(`Command timeout after ${timeout}s: ${command} ${args.join(' ')}`));
      }, timeout * 1000);

      childProcess.on('close', () => {
        clearTimeout(timer);
      });
    });
  }

  /**
   * Reload configuration file
   */
  reloadConfig() {
    logger.info('Reloading cluster configuration');
    this.loadClusters();
  }

  /**
   * Get configuration file statistics
   */
  getStats() {
    const clusters = this.getClusters();
    const types = {};

    for (const cluster of Object.values(clusters)) {
      types[cluster.type] = (types[cluster.type] || 0) + 1;
    }

    return {
      total: Object.keys(clusters).length,
      types,
      default: this.clusters.default,
      current: this.getCurrentCluster(),
      configPath: this.configPath
    };
  }

  /**
   * Check if GKE cluster is authenticated
   * @param {string} clusterId - Cluster ID
   * @returns {Promise<boolean>} Whether authenticated
   */
  async isGkeClusterAuthenticated(clusterId) {
    try {
      const cluster = this.getCluster(clusterId);

      if (cluster.type !== 'gke') {
        return true; // Non-GKE cluster does not need to check
      }

      // Small delay to avoid concurrent kubeconfig file access
      await new Promise(resolve => setTimeout(resolve, 100));

      // Use kubeconfig path (avoid redeclaring const variable)
      const gkeKubeconfigPath = '/home/nodejs/.kube/config';
      const contextName = `gke_${cluster.project}_${cluster.region}_${cluster.cluster}`;

      logger.debug(`Checking GKE cluster authentication for: ${clusterId}`);

      // Check if kubeconfig file exists
      if (!fs.existsSync(gkeKubeconfigPath)) {
        logger.debug(`Kubeconfig file not found: ${gkeKubeconfigPath}`);
        return false;
      }

      // Method 1: Check if target context exists in kubeconfig
      try {
        const allContexts = await this.executeCommand('kubectl', [
          'config', 'get-contexts', '--no-headers',
          '--kubeconfig', gkeKubeconfigPath
        ], { timeout: 10 });

        const hasGkeContext = allContexts.split('\n').some(line => line.includes(contextName));

        if (!hasGkeContext) {
          logger.debug(`GKE cluster ${clusterId} context not found in kubeconfig`);
          return false;
        }

        logger.debug(`GKE cluster ${clusterId} context found in kubeconfig`);
      } catch (listError) {
        logger.debug(`Context list check failed for ${clusterId}: ${listError.message}`);
        return false;
      }

      // Method 2: Check current context and test connectivity
      // Use the same approach as gke_auth verification (no --context parameter)
      try {
        // Get current context
        const currentContext = await this.executeCommand('kubectl', [
          'config', 'current-context',
          '--kubeconfig', gkeKubeconfigPath
        ], { timeout: 10 });

        // If current context is not the target, switch to it
        if (currentContext !== contextName) {
          logger.debug(`Switching to target context ${contextName} from ${currentContext}`);
          await this.executeCommand('kubectl', [
            'config', 'use-context', contextName,
            '--kubeconfig', gkeKubeconfigPath
          ], { timeout: 10 });
        }

        // Test connectivity using the same method as gke_auth verification
        // Only use --kubeconfig, rely on current context (no --context parameter)
        await this.executeCommand('kubectl', [
          'cluster-info',
          '--request-timeout=10s',
          '--kubeconfig', gkeKubeconfigPath
        ], { timeout: 15 });

        logger.debug(`GKE cluster ${clusterId} authenticated successfully`);
        return true;

      } catch (connectError) {
        logger.debug(`GKE cluster ${clusterId} connectivity test failed: ${connectError.message}`);
        return false;
      }

    } catch (error) {
      logger.debug(`GKE cluster ${clusterId} authentication check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate cluster operation prerequisites
   * @param {string} clusterId - Cluster ID
   * @throws {Error} If prerequisites are not met
   */
  async validateClusterPrerequisites(clusterId) {
    if (!clusterId) {
      return; // Use default cluster
    }

    // Check if cluster configuration exists
    if (!this.clusterExists(clusterId)) {
      throw new Error(`Cluster '${clusterId}' does not exist in configuration. Please check clusters.json setting.`);
    }

    const cluster = this.getCluster(clusterId);

    // Check GKE cluster authentication
    if (cluster.type === 'gke') {
      const isAuthenticated = await this.isGkeClusterAuthenticated(clusterId);

      if (!isAuthenticated) {
        throw new Error(
          `GKE cluster '${clusterId}' is not authenticated.\n\n` +
          `Please run authentication command first:\n` +
          `{"tool": "gke_auth", "params": {"cluster": "${clusterId}"}}\n\n` +
          `After authentication is successful, please re-run your command.`
        );
      }
    }

    // Check local cluster kubeconfig file
    if (cluster.type === 'local') {
      if (!fs.existsSync(cluster.kubeconfig)) {
        throw new Error(`Local cluster '${clusterId}' kubeconfig file does not exist: ${cluster.kubeconfig}`);
      }
    }
  }
}

// Create singleton instance
export const clusterManager = new ClusterManager();
