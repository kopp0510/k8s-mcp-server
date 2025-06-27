/**
 * GKE Authentication Tool
 * Authenticate to GKE cluster using service account and get cluster credentials
 */

import { BaseTool } from './base-tool.js';
import { clusterManager } from '../utils/cluster-manager.js';

export class GkeAuthTool extends BaseTool {
  constructor() {
    super('gke_auth', 'Authenticate to GKE cluster using service account and get cluster credentials');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          cluster: {
            type: 'string',
            description: 'GKE cluster ID to authenticate to',
          },
          verify: {
            type: 'boolean',
            description: 'Verify connection after authentication (default: true)',
            default: true
          },
          region: {
            type: 'string',
            description: 'GKE cluster region (optional, overrides config value)',
          }
        },
        required: ['cluster'],
      },
    };
  }

  async execute(args) {
    try {
      const { cluster: clusterName, verify = true, region } = args;

      // Validate input
      this.validateInput(args);

      // Get cluster configuration
      const cluster = clusterManager.getCluster(clusterName);

      if (cluster.type !== 'gke') {
        return this.createErrorResponse(`Cluster '${clusterName}' is not a GKE cluster (type: ${cluster.type})`);
      }

      // If region parameter is provided, override config value
      if (region) {
        cluster.region = region;
      }

      // Perform authentication
      const authResult = await this.performAuthentication(cluster, verify);

      this.logSuccess(args, { cluster: cluster.name, project: cluster.project });
      return this.createResponse(authResult);

    } catch (error) {
      this.logError(error, args);
      return this.createErrorResponse(error.message);
    }
  }

  /**
   * Perform GKE authentication process
   */
  async performAuthentication(cluster, verify) {
    let result = `GKE Authentication Results\n`;
    result += '='.repeat(40) + '\n\n';

    result += `**Cluster Information:**\n`;
    result += `• Name: ${cluster.name}\n`;
    result += `• ID: ${cluster.id}\n`;
    result += `• Project: ${cluster.project}\n`;
    result += `• Cluster: ${cluster.cluster}\n`;
    result += `• Region: ${cluster.region}\n`;
    result += `• Key File: ${cluster.keyFile}\n\n`;

    try {
      // Perform authentication
      result += `**Authentication Process:**\n`;

      const startTime = Date.now();
      await clusterManager.authenticateGKE(cluster);
      const duration = Date.now() - startTime;

      result += `• Service account activation: ✓ Success\n`;
      result += `• Cluster credentials retrieval: ✓ Success\n`;

      if (verify) {
        result += `• Connection verification: ✓ Success\n`;
      }

      result += `• Total time: ${duration}ms\n\n`;

      // Get cluster information
      if (verify) {
        try {
          const clusterInfo = await this.getClusterInfo(cluster);
          result += `**Cluster Status:**\n`;
          result += clusterInfo + '\n';
        } catch (error) {
          result += `**Cluster Status:**\n`;
          result += `• Warning: Could not retrieve cluster status: ${error.message}\n\n`;
        }
      }

      result += `**Next Steps:**\n`;
      result += `• Cluster '${cluster.id}' is now ready for kubectl and helm operations\n`;
      result += `• All kubectl_* and helm_* tools will use this cluster context\n`;
      result += `• Use cluster_list to see current cluster status\n`;
      result += `• Use kubectl_get with cluster parameter to target specific clusters\n\n`;

      result += `**Example Commands:**\n`;
      result += `• List pods: {"resource": "pods", "cluster": "${cluster.id}"}\n`;
      result += `• Get nodes: {"resource": "nodes", "cluster": "${cluster.id}"}\n`;
      result += `• Helm releases: {"allNamespaces": true, "cluster": "${cluster.id}"}\n`;

      return result;

    } catch (error) {
      result += `**Authentication Failed:**\n`;
      result += `• Error: ${error.message}\n\n`;

      result += `**Troubleshooting:**\n`;
      result += `• Check if service account key file exists: ${cluster.keyFile}\n`;
      result += `• Verify service account has required permissions\n`;
      result += `• Confirm cluster name and region are correct\n`;
      result += `• Check network connectivity to GCP\n`;
      result += `• Ensure gcloud CLI is properly installed\n\n`;

      result += `**Required Permissions:**\n`;
      result += `• container.clusters.get\n`;
      result += `• container.clusters.getCredentials\n`;
      result += `• And other necessary GKE permissions\n`;

      throw new Error(result);
    }
  }

  /**
   * Get cluster basic information
   */
  async getClusterInfo(cluster) {
    try {
      const kubeconfigPath = '/home/nodejs/.kube/config';
      const contextName = `gke_${cluster.project}_${cluster.region}_${cluster.cluster}`;

      // Execute basic kubectl command to verify connection
      const output = await clusterManager.executeCommand('kubectl', [
        'cluster-info', '--request-timeout=10s',
        '--context', contextName,
        '--kubeconfig', kubeconfigPath
      ]);

      let info = `• Cluster endpoint: Connected ✓\n`;

      // Parse output for more information
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('Kubernetes control plane')) {
          const url = line.match(/(https?:\/\/[^\s]+)/);
          if (url) {
            info += `• Control plane: ${url[1]}\n`;
          }
        }
        if (line.includes('CoreDNS')) {
          info += `• CoreDNS: Running ✓\n`;
        }
      }

      // Get node information
      try {
        const nodesOutput = await clusterManager.executeCommand('kubectl', [
          'get', 'nodes', '--no-headers', '--request-timeout=5s',
          '--context', contextName,
          '--kubeconfig', kubeconfigPath
        ]);
        const nodeCount = nodesOutput.split('\n').filter(line => line.trim()).length;
        info += `• Nodes: ${nodeCount} available\n`;
      } catch (nodeError) {
        info += `• Nodes: Unable to retrieve (${nodeError.message})\n`;
      }

      // Get namespace information
      try {
        const nsOutput = await clusterManager.executeCommand('kubectl', [
          'get', 'namespaces', '--no-headers', '--request-timeout=5s',
          '--context', contextName,
          '--kubeconfig', kubeconfigPath
        ]);
        const nsCount = nsOutput.split('\n').filter(line => line.trim()).length;
        info += `• Namespaces: ${nsCount} available\n`;
      } catch (nsError) {
        info += `• Namespaces: Unable to retrieve (${nsError.message})\n`;
      }

      return info;

    } catch (error) {
      throw new Error(`Failed to get cluster info: ${error.message}`);
    }
  }

  /**
   * Validate input parameters
   */
  validateInput(args) {
    if (!args.cluster || typeof args.cluster !== 'string') {
      throw new Error('cluster parameter is required and must be a string');
    }

    if (!clusterManager.clusterExists(args.cluster)) {
      const availableClusters = Object.keys(clusterManager.getClusters()).join(', ');
      throw new Error(`Cluster '${args.cluster}' not found. Available clusters: ${availableClusters}`);
    }

    if (args.verify !== undefined && typeof args.verify !== 'boolean') {
      throw new Error('verify parameter must be a boolean');
    }

    if (args.region && typeof args.region !== 'string') {
      throw new Error('region parameter must be a string');
    }
  }
}