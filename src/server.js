/**
 * K8s MCP Server Implementation
 * Focuses on MCP + Express integration
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import { z } from 'zod';
import { logger } from './utils/logger.js';

// Import tool classes
import { KubectlGetTool } from './tools/kubectl-get.js';
import { KubectlLogsTool } from './tools/kubectl-logs.js';
import { KubectlDescribeTool } from './tools/kubectl-describe.js';
import { KubectlClusterInfoTool } from './tools/kubectl-cluster-info.js';
import { KubectlGetYamlTool } from './tools/kubectl-get-yaml.js';
import { KubectlTopNodesTool } from './tools/kubectl-top-nodes.js';
import { KubectlTopPodsTool } from './tools/kubectl-top-pods.js';
import { KubectlTopContainersTool } from './tools/kubectl-top-containers.js';
import { KubectlScaleDeploymentTool } from './tools/kubectl-scale-deployment.js';
import { KubectlRestartDeploymentTool } from './tools/kubectl-restart-deployment.js';
import { KubectlEditHpaTool } from './tools/kubectl-edit-hpa.js';

// Import Helm tool classes
import { HelmListTool } from './tools/helm-list.js';
import { HelmStatusTool } from './tools/helm-status.js';
import { HelmRepoListTool } from './tools/helm-repo-list.js';
import { HelmGetValuesTool } from './tools/helm-get-values.js';
import { HelmHistoryTool } from './tools/helm-history.js';

/**
 * Create and configure MCP Server
 */
function setupMCPServer() {
  // Create MCP Server instance
  const server = new McpServer({
    name: "kubernetes-mcp-server",
    version: "1.0.0"
  });

  // Initialize tool instances
  const kubectlGetTool = new KubectlGetTool();
  const kubectlLogsTool = new KubectlLogsTool();
  const kubectlDescribeTool = new KubectlDescribeTool();
  const kubectlClusterInfoTool = new KubectlClusterInfoTool();
  const kubectlGetYamlTool = new KubectlGetYamlTool();
  const kubectlTopNodesTool = new KubectlTopNodesTool();
  const kubectlTopPodsTool = new KubectlTopPodsTool();
  const kubectlTopContainersTool = new KubectlTopContainersTool();
  const kubectlScaleDeploymentTool = new KubectlScaleDeploymentTool();
  const kubectlRestartDeploymentTool = new KubectlRestartDeploymentTool();
  const kubectlEditHpaTool = new KubectlEditHpaTool();

  // Initialize Helm tool instances
  const helmListTool = new HelmListTool();
  const helmStatusTool = new HelmStatusTool();
  const helmRepoListTool = new HelmRepoListTool();
  const helmGetValuesTool = new HelmGetValuesTool();
  const helmHistoryTool = new HelmHistoryTool();

  // Register tools to MCP Server
  server.tool(
    kubectlGetTool.name,
    kubectlGetTool.getDefinition().inputSchema,
    async (args) => {
      return await kubectlGetTool.execute(args);
    }
  );

  server.tool(
    kubectlLogsTool.name,
    kubectlLogsTool.getDefinition().inputSchema,
    async (args) => {
      return await kubectlLogsTool.execute(args);
    }
  );

  server.tool(
    kubectlDescribeTool.name,
    kubectlDescribeTool.getDefinition().inputSchema,
    async (args) => {
      return await kubectlDescribeTool.execute(args);
    }
  );

  server.tool(
    kubectlClusterInfoTool.name,
    kubectlClusterInfoTool.getDefinition().inputSchema,
    async (args) => {
      return await kubectlClusterInfoTool.execute(args);
    }
  );

  server.tool(
    kubectlGetYamlTool.name,
    kubectlGetYamlTool.getDefinition().inputSchema,
    async (args) => {
      return await kubectlGetYamlTool.execute(args);
    }
  );

  server.tool(
    kubectlTopNodesTool.name,
    kubectlTopNodesTool.getDefinition().inputSchema,
    async (args) => {
      return await kubectlTopNodesTool.execute(args);
    }
  );

  server.tool(
    kubectlTopPodsTool.name,
    kubectlTopPodsTool.getDefinition().inputSchema,
    async (args) => {
      return await kubectlTopPodsTool.execute(args);
    }
  );

  server.tool(
    kubectlTopContainersTool.name,
    kubectlTopContainersTool.getDefinition().inputSchema,
    async (args) => {
      return await kubectlTopContainersTool.execute(args);
    }
  );

  server.tool(
    kubectlScaleDeploymentTool.name,
    kubectlScaleDeploymentTool.getDefinition().inputSchema,
    async (args) => {
      return await kubectlScaleDeploymentTool.execute(args);
    }
  );

  server.tool(
    kubectlRestartDeploymentTool.name,
    kubectlRestartDeploymentTool.getDefinition().inputSchema,
    async (args) => {
      return await kubectlRestartDeploymentTool.execute(args);
    }
  );

  server.tool(
    kubectlEditHpaTool.name,
    kubectlEditHpaTool.getDefinition().inputSchema,
    async (args) => {
      return await kubectlEditHpaTool.execute(args);
    }
  );

  // Register Helm tools to MCP Server
  server.tool(
    helmListTool.name,
    helmListTool.getDefinition().inputSchema,
    async (args) => {
      return await helmListTool.execute(args);
    }
  );

  server.tool(
    helmStatusTool.name,
    helmStatusTool.getDefinition().inputSchema,
    async (args) => {
      return await helmStatusTool.execute(args);
    }
  );

  server.tool(
    helmRepoListTool.name,
    helmRepoListTool.getDefinition().inputSchema,
    async (args) => {
      return await helmRepoListTool.execute(args);
    }
  );

  server.tool(
    helmGetValuesTool.name,
    helmGetValuesTool.getDefinition().inputSchema,
    async (args) => {
      return await helmGetValuesTool.execute(args);
    }
  );

  server.tool(
    helmHistoryTool.name,
    helmHistoryTool.getDefinition().inputSchema,
    async (args) => {
      return await helmHistoryTool.execute(args);
    }
  );

  // Create available tools list
  const availableTools = [
    // Kubectl tools
    kubectlGetTool.getDefinition(),
    kubectlLogsTool.getDefinition(),
    kubectlDescribeTool.getDefinition(),
    kubectlClusterInfoTool.getDefinition(),
    kubectlGetYamlTool.getDefinition(),
    kubectlTopNodesTool.getDefinition(),
    kubectlTopPodsTool.getDefinition(),
    kubectlTopContainersTool.getDefinition(),
    kubectlScaleDeploymentTool.getDefinition(),
    kubectlRestartDeploymentTool.getDefinition(),
    kubectlEditHpaTool.getDefinition(),
    // Helm tools
    helmListTool.getDefinition(),
    helmStatusTool.getDefinition(),
    helmRepoListTool.getDefinition(),
    helmGetValuesTool.getDefinition(),
    helmHistoryTool.getDefinition()
  ];

  return {
    server,
    availableTools,
    tools: {
      // Kubectl tools
      kubectlGetTool,
      kubectlLogsTool,
      kubectlDescribeTool,
      kubectlClusterInfoTool,
      kubectlGetYamlTool,
      kubectlTopNodesTool,
      kubectlTopPodsTool,
      kubectlTopContainersTool,
      kubectlScaleDeploymentTool,
      kubectlRestartDeploymentTool,
      kubectlEditHpaTool,
      // Helm tools
      helmListTool,
      helmStatusTool,
      helmRepoListTool,
      helmGetValuesTool,
      helmHistoryTool
    }
  };
}

/**
 * Create MCP message processor
 */
function createMCPHandler(tools, availableTools) {
  const {
    // Kubectl tools
    kubectlGetTool, kubectlLogsTool, kubectlDescribeTool, kubectlClusterInfoTool, kubectlGetYamlTool, kubectlTopNodesTool, kubectlTopPodsTool, kubectlTopContainersTool, kubectlScaleDeploymentTool, kubectlRestartDeploymentTool, kubectlEditHpaTool,
    // Helm tools
    helmListTool, helmStatusTool, helmRepoListTool, helmGetValuesTool, helmHistoryTool
  } = tools;

  return async (message) => {
    try {
      // Process tools list request
      if (message.method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: availableTools
          }
        };
      }

      // Process tools execution request
      if (message.method === 'tools/call') {
        const toolName = message.params?.name;
        const toolArgs = message.params?.arguments || {};

        logger.info(`Executing tool: ${toolName}`, toolArgs);

        let result;
        switch (toolName) {
          case 'kubectl_get':
            result = await kubectlGetTool.execute(toolArgs);
            break;
          case 'kubectl_logs':
            result = await kubectlLogsTool.execute(toolArgs);
            break;
          case 'kubectl_describe':
            result = await kubectlDescribeTool.execute(toolArgs);
            break;
          case 'kubectl_cluster_info':
            result = await kubectlClusterInfoTool.execute(toolArgs);
            break;
          case 'kubectl_get_yaml':
            result = await kubectlGetYamlTool.execute(toolArgs);
            break;
          case 'kubectl_top_nodes':
            result = await kubectlTopNodesTool.execute(toolArgs);
            break;
          case 'kubectl_top_pods':
            result = await kubectlTopPodsTool.execute(toolArgs);
            break;
          case 'kubectl_top_containers':
            result = await kubectlTopContainersTool.execute(toolArgs);
            break;
          case 'kubectl_scale_deployment':
            result = await kubectlScaleDeploymentTool.execute(toolArgs);
            break;
          case 'kubectl_restart_deployment':
            result = await kubectlRestartDeploymentTool.execute(toolArgs);
            break;
          case 'kubectl_edit_hpa':
            result = await kubectlEditHpaTool.execute(toolArgs);
            break;
          // Helm tools
          case 'helm_list':
            result = await helmListTool.execute(toolArgs);
            break;
          case 'helm_status':
            result = await helmStatusTool.execute(toolArgs);
            break;
          case 'helm_repo_list':
            result = await helmRepoListTool.execute(toolArgs);
            break;
          case 'helm_get_values':
            result = await helmGetValuesTool.execute(toolArgs);
            break;
          case 'helm_history':
            result = await helmHistoryTool.execute(toolArgs);
            break;
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }

        return {
          jsonrpc: '2.0',
          id: message.id,
          result: result
        };
      }

      // Process initialization request
      if (message.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'kubernetes-mcp-server',
              version: '1.0.0'
            }
          }
        };
      }

      // Unknown method
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32601,
          message: `Method not found: ${message.method}`
        }
      };

    } catch (error) {
      logger.error('MCP message processing failed:', error);
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: `Execution error: ${error.message}`
        }
      };
    }
  };
}

/**
 * Create Express application (SSE mode)
 */
function createExpressApp(tools, availableTools) {
  const app = express();
  app.use(express.json());

  // SSE connection management
  const sseConnections = new Map();

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'k8s-mcp-server',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      mode: 'sse',
      tools: availableTools.map(tool => ({
        name: tool.name,
        description: tool.description
      }))
    });
  });

  // SSE endpoint - n8n will connect here
  app.get('/sse', (req, res) => {
    const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Store connection
    sseConnections.set(sessionId, res);

    // Send initial message - tell n8n message sending endpoint
    res.write(`event: endpoint\n`);
    res.write(`data: /messages?sessionId=${sessionId}\n\n`);

    // Keep-alive ping
    const pingInterval = setInterval(() => {
      if (sseConnections.has(sessionId)) {
        res.write(`event: ping\n`);
        res.write(`data: ${Date.now()}\n\n`);
      } else {
        clearInterval(pingInterval);
      }
    }, 15000);

    // Handle connection closure
    req.on('close', () => {
      logger.info(`SSE connection closed: ${sessionId}`);
      sseConnections.delete(sessionId);
      clearInterval(pingInterval);
    });

    logger.info(`SSE connection established: ${sessionId}`);
  });

  // Message endpoint - n8n will send MCP requests here
  const mcpHandler = createMCPHandler(tools, availableTools);

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId;
    const sseRes = sseConnections.get(sessionId);

    if (!sseRes) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid session' },
        id: null
      });
    }

    try {
      const message = req.body;
      logger.info(`Received MCP request: ${message.method}`);

      const response = await mcpHandler(message);

      // Send response through SSE
      sseRes.write(`event: message\n`);
      sseRes.write(`data: ${JSON.stringify(response)}\n\n`);

      // Give HTTP request response 200
      res.status(200).json({ status: 'sent' });

    } catch (error) {
      logger.error('Failed to process MCP message:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  });

  return { app, sseConnections };
}

/**
 * Create and start MCP Server
 */
export async function createMCPServer(config) {
  const { httpMode, port } = config;

  try {
    // Set MCP Server and tools
    const { server, availableTools, tools } = setupMCPServer();

    if (httpMode) {
      // SSE mode (n8n compatible)
      const { app, sseConnections } = createExpressApp(tools, availableTools);

      const httpServer = app.listen(port, () => {
        logger.info(`MCP Server started at http://localhost:${port}`);
        logger.info(`SSE endpoint: http://localhost:${port}/sse (n8n connects here)`);
        logger.info(`Message endpoint: http://localhost:${port}/messages`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`Available tools: ${availableTools.map(t => t.name).join(', ')}`);
        logger.info(`SSE mode - specifically designed for n8n`);
      });

      // Return server instance for graceful shutdown
      return {
        close: async () => {
          logger.info('Shutting down HTTP server...');
          // Close all SSE connections
          for (const [sessionId, res] of sseConnections) {
            res.end();
            logger.info(`Closed SSE connection: ${sessionId}`);
          }
          sseConnections.clear();

          // Close HTTP server
          return new Promise((resolve, reject) => {
            httpServer.close((error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          });
        }
      };

    } else {
      // Stdio mode (default) - use MCP SDK standard way
      logger.info('Starting MCP Server (stdio mode)');

      const transport = new StdioServerTransport();
      await server.connect(transport);

      logger.info('MCP Server started and listening stdio');
      logger.info(`Available tools: ${availableTools.map(t => t.name).join(', ')}`);

      // Return server instance
      return {
        close: async () => {
          logger.info('Shutting down MCP Server...');
          // In Stdio mode, server will close with program end
        }
      };
    }

  } catch (error) {
    logger.error('MCP Server startup failed:', error);
    throw error;
  }
}