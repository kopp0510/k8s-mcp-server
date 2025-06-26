/**
 * Cluster Manager - 多叢集管理工具
 * 負責載入叢集配置、GKE 認證和叢集切換
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
   * 載入叢集配置檔案
   */
  loadClusters() {
    try {
      if (!fs.existsSync(this.configPath)) {
        logger.warn(`Cluster configuration file not found: ${this.configPath}`);
        // 建立預設配置
        this.clusters = this.getDefaultConfig();
        return;
      }

      const data = fs.readFileSync(this.configPath, 'utf8');
      this.clusters = JSON.parse(data);

      // 驗證配置檔案結構
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
   * 驗證配置檔案結構
   */
  validateConfig() {
    if (!this.clusters.clusters || typeof this.clusters.clusters !== 'object') {
      throw new Error('Invalid configuration: missing clusters object');
    }

    if (!this.clusters.default || !this.clusters.clusters[this.clusters.default]) {
      throw new Error(`Invalid configuration: default cluster '${this.clusters.default}' not found`);
    }

    // 驗證每個叢集配置
    for (const [id, cluster] of Object.entries(this.clusters.clusters)) {
      this.validateClusterConfig(id, cluster);
    }
  }

  /**
   * 驗證單個叢集配置
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
   * 取得預設配置（當配置檔案不存在時）
   */
  getDefaultConfig() {
    return {
      clusters: {
        local: {
          name: "Local Kubernetes",
          type: "local",
          description: "地端 Kubernetes 叢集",
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
   * 取得所有叢集
   */
  getClusters() {
    return this.clusters.clusters;
  }

  /**
   * 取得特定叢集配置
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
   * 取得可用的叢集列表
   */
  getAvailableClusters() {
    const clusters = this.getClusters();
    return Object.keys(clusters).map(id => ({
      id,
      ...clusters[id]
    }));
  }

  /**
   * 取得預設叢集
   */
  getDefaultCluster() {
    return this.getCluster(this.clusters.default);
  }

  /**
   * 檢查叢集是否存在
   */
  clusterExists(clusterName) {
    return !!this.clusters.clusters[clusterName];
  }

  /**
   * GKE 叢集認證
   */
  async authenticateGKE(cluster) {
    if (cluster.type !== 'gke') {
      return;
    }

    logger.info(`Starting GKE authentication for cluster: ${cluster.name}`, {
      project: cluster.project,
      cluster: cluster.cluster,
      region: cluster.region
    });

    try {
      // 檢查 service account key 檔案是否存在
      if (!fs.existsSync(cluster.keyFile)) {
        throw new Error(`Service account key file not found: ${cluster.keyFile}`);
      }

      // 1. Service account 認證
      logger.debug('Activating service account');
      await this.executeCommand('gcloud', [
        'auth', 'activate-service-account',
        '--key-file', cluster.keyFile,
        '--quiet'
      ]);

      // 2. 取得叢集 credentials
      logger.debug('Getting cluster credentials');
      await this.executeCommand('gcloud', [
        'container', 'clusters', 'get-credentials',
        cluster.cluster,
        '--region', cluster.region,
        '--project', cluster.project,
        '--quiet'
      ]);

      // 3. 驗證連線
      logger.debug('Verifying cluster connection');
      await this.executeCommand('kubectl', ['cluster-info', '--request-timeout=10s']);

      this.currentCluster = cluster.id;

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
   * 切換到指定叢集
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
        // 對於 local 類型，檢查 kubeconfig 是否存在
        if (!fs.existsSync(cluster.kubeconfig)) {
          throw new Error(`Kubeconfig file not found: ${cluster.kubeconfig}`);
        }

        // 如果有指定 context，切換到該 context
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
   * 取得目前使用的叢集
   */
  getCurrentCluster() {
    return this.currentCluster || this.clusters.default;
  }

  /**
   * 執行系統指令
   */
  async executeCommand(command, args, options = {}) {
    const timeout = options.timeout || this.clusters.configuration?.gke_auth_timeout || 300;

    return new Promise((resolve, reject) => {
      logger.debug(`Executing command: ${command} ${args.join(' ')}`);

      const process = spawn(command, args, {
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          const error = stderr.trim() || `Command failed with code ${code}`;
          logger.error(`Command execution failed: ${command}`, {
            args: args.join(' '),
            code,
            stderr: error
          });
          reject(new Error(error));
        }
      });

      process.on('error', (error) => {
        logger.error(`Command execution error: ${command}`, error);
        reject(error);
      });

      // 設定超時
      const timer = setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error(`Command timeout after ${timeout}s: ${command}`));
      }, timeout * 1000);

      process.on('close', () => {
        clearTimeout(timer);
      });
    });
  }

  /**
   * 重新載入配置檔案
   */
  reloadConfig() {
    logger.info('Reloading cluster configuration');
    this.loadClusters();
  }

  /**
   * 取得配置檔案統計資訊
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
}

// 建立單例實例
export const clusterManager = new ClusterManager();