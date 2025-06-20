#!/usr/bin/env node

/**
 * 自開發的 Kubernetes MCP Server
 * 支援 SSE 模式 (n8n 相容)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import { z } from 'zod';
import { logger } from './utils/logger.js';

// 匯入工具類別
import { KubectlGetTool } from './tools/kubectl-get.js';
import { KubectlLogsTool } from './tools/kubectl-logs.js';
import { KubectlDescribeTool } from './tools/kubectl-describe.js';

// 創建 MCP Server 實例
const server = new McpServer({
  name: "kubernetes-mcp-server",
  version: "1.0.0"
});

// 初始化工具實例
const kubectlGetTool = new KubectlGetTool();
const kubectlLogsTool = new KubectlLogsTool();
const kubectlDescribeTool = new KubectlDescribeTool();

// 註冊工具到 MCP Server
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

// SSE 連接管理
const sseConnections = new Map();

// 創建可用工具列表
const availableTools = [
  kubectlGetTool.getDefinition(),
  kubectlLogsTool.getDefinition(),
  kubectlDescribeTool.getDefinition()
];

// 創建 MCP 訊息處理器
function createMCPHandler() {
  return async (message) => {
    try {
      // 處理工具列表請求
      if (message.method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: availableTools
          }
        };
      }

      // 處理工具執行請求
      if (message.method === 'tools/call') {
        const toolName = message.params?.name;
        const toolArgs = message.params?.arguments || {};

        logger.info(`執行工具: ${toolName}`, toolArgs);

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
           default:
             throw new Error(`未知的工具: ${toolName}`);
         }

        return {
          jsonrpc: '2.0',
          id: message.id,
          result: result
        };
      }

      // 處理初始化請求
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

      // 未知方法
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32601,
          message: `Method not found: ${message.method}`
        }
      };

    } catch (error) {
      logger.error('MCP 訊息處理失敗:', error);
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: `執行錯誤: ${error.message}`
        }
      };
    }
  };
}

// 主函數
async function main() {
  const args = process.argv.slice(2);
  const httpMode = args.includes('--http');
  const port = args.includes('--port') ?
    parseInt(args[args.indexOf('--port') + 1]) : 3000;

  try {
    if (httpMode) {
      // SSE 模式 (n8n 相容)
      const app = express();
      app.use(express.json());

      // 健康檢查
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

      // SSE 端點 - n8n 會連接這裡
      app.get('/sse', (req, res) => {
        const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

        // 設定 SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });

        // 儲存連接
        sseConnections.set(sessionId, res);

        // 發送初始訊息 - 告知 n8n 訊息發送端點
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

        // 處理連接關閉
        req.on('close', () => {
          logger.info(`SSE 連接關閉: ${sessionId}`);
          sseConnections.delete(sessionId);
          clearInterval(pingInterval);
        });

        logger.info(`SSE 連接建立: ${sessionId}`);
      });

      // 訊息端點 - n8n 會發送 MCP 請求到這裡
      const mcpHandler = createMCPHandler();

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
          logger.info(`收到 MCP 請求: ${message.method}`);

          const response = await mcpHandler(message);

          // 透過 SSE 發送回應
          sseRes.write(`event: message\n`);
          sseRes.write(`data: ${JSON.stringify(response)}\n\n`);

          // 給 HTTP 請求回應 200
          res.status(200).json({ status: 'sent' });

        } catch (error) {
          logger.error('處理 MCP 訊息失敗:', error);
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null
          });
        }
      });

      app.listen(port, () => {
        logger.info(`🚀 MCP Server 已啟動在 http://localhost:${port}`);
        logger.info(`📡 SSE 端點: http://localhost:${port}/sse (n8n 連接這裡)`);
        logger.info(`📨 訊息端點: http://localhost:${port}/messages`);
        logger.info(`💚 健康檢查: http://localhost:${port}/health`);
        logger.info(`🛠️  可用工具: ${availableTools.map(t => t.name).join(', ')}`);
        logger.info(`ℹ️  SSE 模式 - 專為 n8n 設計`);
      });
    } else {
      // Stdio 模式 (預設)
      logger.info('🔌 啟動 MCP Server (stdio 模式)');
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logger.info('✅ MCP Server 已啟動並監聽 stdio');
      logger.info(`🛠️  可用工具: ${availableTools.map(t => t.name).join(', ')}`);
    }
  } catch (error) {
    logger.error('❌ MCP Server 啟動失敗:', error);
    process.exit(1);
  }
}

// 如果直接執行此檔案
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('應用程式錯誤:', error);
    process.exit(1);
  });
}