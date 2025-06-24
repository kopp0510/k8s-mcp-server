/**
 * Kubectl Cluster Info Tool
 * Get Kubernetes cluster information, including control plane and service endpoints
 */

import { BaseTool } from './base-tool.js';
import { kubectl } from '../utils/kubectl.js';

export class KubectlClusterInfoTool extends BaseTool {
  constructor() {
    super('kubectl_cluster_info', 'Get Kubernetes cluster information, including control plane and service endpoints');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          dump: {
            type: 'boolean',
            description: 'Get detailed cluster state dump information (equivalent to kubectl cluster-info dump)',
            default: false,
          },
        },
        required: [],
      },
    };
  }

  async execute(args) {
    try {
      const { dump = false } = args;

      // Build kubectl command
      const cmdArgs = ['cluster-info'];
      if (dump) {
        cmdArgs.push('dump');
      }

      // Execute command
      const result = await kubectl.execute(cmdArgs);

      // If dump mode, return raw output directly
      if (dump) {
        return this.createResponse(result);
      }

      // Normal mode, parse and format output
      const output = result;

      // Parse cluster-info output
      const lines = output.split('\n').filter(line => line.trim());

      // Extract cluster information
      const clusterInfo = {};
      let currentService = null;

      for (const line of lines) {
        if (line.includes('Kubernetes control plane')) {
          clusterInfo.controlPlane = this.extractUrl(line);
        } else if (line.includes('CoreDNS')) {
          clusterInfo.coreDNS = this.extractUrl(line);
        } else if (line.includes('running at')) {
          const serviceName = line.split(' is running at')[0].trim();
          clusterInfo[serviceName] = this.extractUrl(line);
        }
      }

      let formatted = 'Cluster Information\n' + '='.repeat(50) + '\n\n';

      // Control plane information
      if (clusterInfo.controlPlane) {
        const url = clusterInfo.controlPlane;
        formatted += `**Control Plane**\n`;
        formatted += `   Status: Running\n`;
        formatted += `   Endpoint: ${url[0]}\n\n`;
      }

      // CoreDNS information
      if (clusterInfo.coreDNS) {
        const url = clusterInfo.coreDNS;
        formatted += `**CoreDNS Service**\n`;
        formatted += `   Status: Running\n`;
        formatted += `   Endpoint: ${url[0]}\n\n`;
      }

      // Handle other services
      for (const [service, url] of Object.entries(clusterInfo)) {
        if (service !== 'controlPlane' && service !== 'coreDNS') {
          formatted += `**${service}**\n`;
          formatted += `   Status: Running\n`;
          formatted += `   Endpoint: ${url[0]}\n\n`;
        }
      }

      formatted += `**Debug Tips**\n`;
      formatted += `   To get detailed cluster information, use: {"dump": true}\n\n`;

      formatted += `**Detailed Information**\n`;
      formatted += `   Use dump: true parameter to get complete cluster state dump\n\n`;

      // Other important information
      formatted += `**Command Equivalent**\n`;
      formatted += `   kubectl cluster-info\n`;
      if (dump) {
        formatted += `   kubectl cluster-info dump\n`;
      }

      return this.createResponse(formatted);

    } catch (error) {
      return this.createErrorResponse(`Failed to get cluster information: ${error.message}`);
    }
  }

  extractUrl(line) {
    const matches = line.match(/https?:\/\/[^\s]+/g);
    return matches || [];
  }
}