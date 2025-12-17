/**
 * K8s MCP Server Implementation
 * Focuses on MCP + Express integration
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import { z } from 'zod';
import { logger } from './utils/logger.js';
import { PrerequisiteError } from './tools/base-tool.js';

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

// Import cluster management tools
import { ClusterListTool } from './tools/cluster-list.js';
import { GkeAuthTool } from './tools/gke-auth.js';

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

  // Initialize cluster management tool instances
  const clusterListTool = new ClusterListTool();
  const gkeAuthTool = new GkeAuthTool();

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

  // Register cluster management tools to MCP Server
  server.tool(
    clusterListTool.name,
    clusterListTool.getDefinition().inputSchema,
    async (args) => {
      return await clusterListTool.execute(args);
    }
  );

  server.tool(
    gkeAuthTool.name,
    gkeAuthTool.getDefinition().inputSchema,
    async (args) => {
      return await gkeAuthTool.execute(args);
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
    helmHistoryTool.getDefinition(),
    // Cluster management tools
    clusterListTool.getDefinition(),
    gkeAuthTool.getDefinition()
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
      helmHistoryTool,
      // Cluster management tools
      clusterListTool,
      gkeAuthTool
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
    helmListTool, helmStatusTool, helmRepoListTool, helmGetValuesTool, helmHistoryTool,
    // Cluster management tools
    clusterListTool, gkeAuthTool
  } = tools;

  return async (message) => {
    try {
      // === MCP 協議生命週期處理 ===

      // Process initialization request (必須首先處理)
      if (message.method === 'initialize') {
        logger.info('Received initialize request', message.params);
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

      // Process initialized notification (修正 - 必需！)
      if (message.method === 'notifications/initialized') {
        logger.info('Client initialized successfully', {
          messageId: message.id,
          params: message.params,
          fullMessage: message
        });

        // 根據 MCP 協議，notifications/initialized 不應該有 id
        // 如果有 id，則不是標準的通知格式
        if (message.id !== undefined && message.id !== null) {
          logger.warn('notifications/initialized should not have id, treating as malformed request');
          // 返回成功響應給帶有 id 的錯誤格式請求
          return {
            jsonrpc: '2.0',
            id: message.id,
            result: {}  // 空物件而不是 null
          };
        }

        // 對於正確的通知格式（無 id），返回空響應而不是 null (Dify 相容性)
        logger.info('Standard notification received, returning empty response for Dify compatibility');
        return {
          jsonrpc: '2.0',
          result: null
        };
      }

      // Process other notifications (改善)
      if (message.method && message.method.startsWith('notifications/')) {
        logger.info(`Received notification: ${message.method}`, {
          params: message.params,
          hasId: message.id !== undefined
        });

        // 處理其他可能的通知
        switch (message.method) {
          case 'notifications/cancelled':
            logger.info('Request cancelled by client');
            break;
          case 'notifications/progress':
            logger.info('Progress notification received');
            break;
          default:
            logger.warn(`Unknown notification: ${message.method}`);
            // 對於未知通知，如果有 id 則返回錯誤響應
            if (message.id !== undefined && message.id !== null) {
              return {
                jsonrpc: '2.0',
                id: message.id,
                error: {
                  code: -32601,
                  message: `Unknown notification method: ${message.method}`
                }
              };
            }
        }

        // 對於有 id 的通知（不符合標準但需要相容），返回成功響應
        if (message.id !== undefined && message.id !== null) {
          logger.info(`Notification with id received, returning ack response`);
          return {
            jsonrpc: '2.0',
            id: message.id,
            result: {}
          };
        }

        // 標準通知返回空響應 (Dify 相容性)
        return {
          jsonrpc: '2.0',
          result: null
        };
      }

      // === 工具相關請求處理 ===

      // Process tools list request
      if (message.method === 'tools/list') {
        logger.info('Returning tools list');
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
          // Cluster management tools
          case 'cluster_list':
            result = await clusterListTool.execute(toolArgs);
            break;
          case 'gke_auth':
            result = await gkeAuthTool.execute(toolArgs);
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

      // === 其他 MCP 方法處理 ===

      // Process resources list request (可選支援)
      if (message.method === 'resources/list') {
        logger.info('Resources list requested');
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            resources: []  // 目前不提供資源
          }
        };
      }

      // Process prompts list request (可選支援)
      if (message.method === 'prompts/list') {
        logger.info('Prompts list requested');
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            prompts: []  // 目前不提供提示模板
          }
        };
      }

      // Process ping (健康檢查)
      if (message.method === 'ping') {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            status: 'pong',
            timestamp: Date.now(),
            server: 'kubernetes-mcp-server'
          }
        };
      }

      // === 錯誤處理 ===

      // Unknown method (改善日誌)
      logger.warn(`Unknown method: ${message.method}`, {
        messageId: message.id,
        params: message.params,
        fullMessage: JSON.stringify(message, null, 2)
      });

      // 更詳細的錯誤響應
      return {
        jsonrpc: '2.0',
        id: message.id || null,
        error: {
          code: -32601,
          message: `Method not found: ${message.method}`,
          data: {
            availableMethods: [
              'initialize',
              'notifications/initialized',
              'tools/list',
              'tools/call',
              'resources/list',
              'prompts/list',
              'ping'
            ],
            receivedMethod: message.method
          }
        }
      };

    } catch (error) {
      logger.error('MCP message processing failed:', error);

      // 檢查是否為前置條件錯誤
      if (error instanceof PrerequisiteError) {
        logger.warn(`前置條件錯誤，轉換為工具回應傳給 AI agent`, {
          errorType: 'PrerequisiteError',
          cluster: error.cluster,
          tool: error.tool,
          willForwardToAgent: true
        });

        // 將前置條件錯誤轉換為成功的工具回應，讓 AI agent 能讀取處理
        const prerequisiteErrorResponse = {
          content: [{
            type: 'text',
            text: `錯誤: 前置條件檢查失敗\n\n` +
                  `錯誤詳情:\n${error.message}\n\n` +
                  `叢集: ${error.cluster || '未指定'}\n` +
                  `工具: ${error.tool || '未知'}\n\n` +
                  `建議動作:\n` +
                  `1. 檢查叢集認證狀態\n` +
                  `2. 執行必要的認證步驟\n` +
                  `3. 重新執行操作\n\n` +
                  `錯誤類型: PrerequisiteError\n` +
                  `需要處理: 是`
          }],
          metadata: {
            errorType: 'PrerequisiteError',
            cluster: error.cluster,
            tool: error.tool,
            requiresAction: true,
            suggestion: error.message
          }
        };

        logger.info(`前置條件錯誤已轉換為工具回應，AI agent 可以處理`, {
          responseType: 'ToolResponse',
          errorType: 'PrerequisiteError',
          forwardedToAgent: true
        });

        return {
          jsonrpc: '2.0',
          id: message.id,
          result: prerequisiteErrorResponse // 使用 result 而不是 error
        };
      }

      // 一般執行錯誤
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
// 配置常數
const MAX_REQUEST_SIZE = '1mb';  // 請求大小限制
const MAX_SSE_CONNECTIONS = 100; // SSE 最大連接數

function createExpressApp(tools, availableTools) {
  const app = express();

  // 安全性：限制請求大小，防止記憶體溢出攻擊
  app.use(express.json({ limit: MAX_REQUEST_SIZE }));

  // SSE connection management
  const sseConnections = new Map();

  // 添加 CORS 支持 (新增)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Health check (保持現有)
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'k8s-mcp-server',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      mode: 'hybrid', // 改為 hybrid 模式
      transports: ['sse', 'streamable_http'], // 支援的傳輸方式
      tools: availableTools.map(tool => ({
        name: tool.name,
        description: tool.description
      }))
    });
  });

  // SSE endpoint - n8n will connect here (改善除錯和健康狀態)
  app.get('/sse', (req, res) => {
    // 安全性：限制 SSE 連接數量，防止資源耗盡
    if (sseConnections.size >= MAX_SSE_CONNECTIONS) {
      logger.warn(`SSE connection rejected: max connections reached`, {
        currentConnections: sseConnections.size,
        maxConnections: MAX_SSE_CONNECTIONS
      });
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: `Maximum SSE connections (${MAX_SSE_CONNECTIONS}) reached. Please try again later.`
      });
    }

    const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    logger.info(`SSE connection request`, {
      sessionId: sessionId,
      userAgent: req.get('User-Agent'),
      origin: req.get('Origin'),
      referer: req.get('Referer'),
      currentConnections: sseConnections.size
    });

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Session-ID': sessionId  // 新增 header 幫助除錯
    });

    // Store connection
    sseConnections.set(sessionId, res);

    // Send initial message - tell n8n message sending endpoint
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({
      sessionId: sessionId,
      messageEndpoint: `/messages?sessionId=${sessionId}`,
      timestamp: Date.now(),
      serverInfo: {
        name: 'kubernetes-mcp-server',
        version: '1.0.0'
      }
    })}\n\n`);

    // 發送端點資訊（為了向後相容）
    res.write(`event: endpoint\n`);
    res.write(`data: /messages?sessionId=${sessionId}\n\n`);

    // Keep-alive ping (更頻繁，更多資訊)
    const pingInterval = setInterval(() => {
      if (sseConnections.has(sessionId)) {
        try {
          res.write(`event: ping\n`);
          res.write(`data: ${JSON.stringify({
            timestamp: Date.now(),
            sessionId: sessionId,
            activeConnections: sseConnections.size
          })}\n\n`);
        } catch (error) {
          logger.warn(`Failed to send ping to session ${sessionId}:`, error.message);
          sseConnections.delete(sessionId);
          clearInterval(pingInterval);
        }
      } else {
        clearInterval(pingInterval);
      }
    }, 10000); // 改為 10 秒一次

    // Handle connection closure
    req.on('close', () => {
      logger.info(`SSE connection closed: ${sessionId}`, {
        remainingConnections: sseConnections.size - 1
      });
      sseConnections.delete(sessionId);
      clearInterval(pingInterval);
    });

    // Handle errors
    req.on('error', (error) => {
      logger.error(`SSE connection error: ${sessionId}`, error);
      sseConnections.delete(sessionId);
      clearInterval(pingInterval);
    });

    logger.info(`SSE connection established: ${sessionId}`, {
      totalConnections: sseConnections.size
    });
  });

  // Message endpoint - n8n will send MCP requests here
  const mcpHandler = createMCPHandler(tools, availableTools);

  // Message endpoint - n8n will send MCP requests here (完全重構錯誤處理)
  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId;

    logger.info(`Messages endpoint called`, {
      sessionId: sessionId,
      hasSessionId: !!sessionId,
      activeConnections: sseConnections.size,
      connectionIds: Array.from(sseConnections.keys()),
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type')
    });

    // 改進：如果沒有 sessionId，嘗試直接處理 (支援 Dify 直接調用)
    if (!sessionId) {
      try {
        const message = req.body;
        logger.info(`Direct MCP request to /messages (no sessionId): ${message?.method}`);

        const response = await mcpHandler(message);
        return res.json(response);

      } catch (error) {
        logger.error('Direct message processing failed:', error);
        return res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        });
      }
    }

    // SSE 會話處理 (改善錯誤處理)
    const sseRes = sseConnections.get(sessionId);
    if (!sseRes) {
      logger.warn(`SSE session not found`, {
        requestedSessionId: sessionId,
        activeConnections: Array.from(sseConnections.keys()),
        totalConnections: sseConnections.size,
        suggestion: 'Client should establish SSE connection first via /sse endpoint'
      });

      // 更友善的錯誤回應，包含建議
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Invalid or expired SSE session',
          data: {
            sessionId: sessionId,
            activeConnections: sseConnections.size,
            suggestion: 'Please establish SSE connection first via GET /sse endpoint',
            endpoints: {
              sse: '/sse',
              direct: '/mcp',
              health: '/health'
            }
          }
        },
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

  // 1. MCP 端點 - 支援 POST 和 GET
  app.all('/mcp', async (req, res) => {
    try {
      if (req.method === 'GET') {
        // GET 請求 - 可用於建立 SSE 連線（如果需要的話）
        const acceptHeader = req.get('Accept') || '';

        if (acceptHeader.includes('text/event-stream')) {
          // 客戶端想要 SSE 串流
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          });

          // 發送初始化事件
          res.write(`event: connected\n`);
          res.write(`data: ${JSON.stringify({status: 'connected', timestamp: Date.now()})}\n\n`);

          // 保持連線
          const keepAlive = setInterval(() => {
            res.write(`event: ping\n`);
            res.write(`data: ${Date.now()}\n\n`);
          }, 30000);

          req.on('close', () => {
            clearInterval(keepAlive);
          });

        } else {
          // 普通 GET 請求 - 返回服務器信息
          res.json({
            jsonrpc: '2.0',
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
          });
        }

      } else if (req.method === 'POST') {
        // POST 請求 - 處理標準 MCP JSON-RPC 消息
        const message = req.body;
        const acceptHeader = req.get('Accept') || '';

        logger.info(`Received MCP request via /mcp: ${message.method}`, {
          transport: 'streamable_http',
          acceptsSSE: acceptHeader.includes('text/event-stream')
        });

        const response = await mcpHandler(message);

        // 檢查客戶端是否接受 SSE
        if (acceptHeader.includes('text/event-stream')) {
          // 返回 SSE 格式
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });

          res.write(`event: message\n`);
          res.write(`data: ${JSON.stringify(response)}\n\n`);
          res.end();

        } else {
          // 返回標準 JSON 格式
          res.json(response);
        }

      } else {
        // 不支援的 HTTP 方法
        res.status(405).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: `Method ${req.method} not allowed`
          },
          id: null
        });
      }

    } catch (error) {
      logger.error('MCP endpoint error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: `Internal server error: ${error.message}`
        },
        id: null
      });
    }
  });

  // === 新增：工具列表端點 (方便調試) ===
  app.get('/tools', (req, res) => {
    res.json({
      jsonrpc: '2.0',
      result: {
        tools: availableTools
      }
    });
  });

  // === 新增：SSE 連接狀態端點 ===
  app.get('/sse-status', (req, res) => {
    const connections = Array.from(sseConnections.entries()).map(([sessionId, connection]) => ({
      sessionId: sessionId,
      connected: !connection.destroyed,
      writable: connection.writable,
      age: Date.now() - parseInt(sessionId.substring(0, 13)) // 從 sessionId 計算年齡
    }));

    res.json({
      totalConnections: sseConnections.size,
      connections: connections,
      timestamp: Date.now(),
      server: {
        name: 'kubernetes-mcp-server',
        version: '1.0.0'
      }
    });
  });

  // === 新增：服務器信息端點 ===
  app.get('/info', (req, res) => {
    res.json({
      name: 'kubernetes-mcp-server',
      version: '1.0.0',
      protocolVersion: '2024-11-05',
      transports: ['stdio', 'sse', 'streamable_http'],
      endpoints: {
        health: '/health',
        mcp: '/mcp',
        sse: '/sse',
        'sse-status': '/sse-status',
        messages: '/messages',
        tools: '/tools',
        info: '/info'
      },
      capabilities: {
        tools: {},
        resources: false,
        prompts: false
      },
      statistics: {
        activeSSEConnections: sseConnections.size,
        availableTools: availableTools.length
      }
    });
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

      // 在 httpServer.listen 的回調中更新日誌：
      const httpServer = app.listen(port, () => {
        logger.info(`MCP Server started at http://localhost:${port}`);
        logger.info(`=== Endpoints ===`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`MCP (Streamable HTTP): http://localhost:${port}/mcp (Dify compatible)`);
        logger.info(`SSE endpoint: http://localhost:${port}/sse (n8n compatible)`);
        logger.info(`Message endpoint: http://localhost:${port}/messages`);
        logger.info(`Tools list: http://localhost:${port}/tools`);
        logger.info(`Server info: http://localhost:${port}/info`);
        logger.info(`Available tools: ${availableTools.map(t => t.name).join(', ')}`);
        logger.info(`Hybrid mode - supports both SSE and Streamable HTTP transport`);
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