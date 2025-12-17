/**
 * MCP 伺服器整合測試 - 行為驅動開發 (BDD)
 * 使用 Given-When-Then 格式測試完整的 MCP 協議流程
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createMCPServer } from '../../src/server.js';

/**
 * 測試工具函數：發送 JSON-RPC 請求到 HTTP 伺服器
 */
async function sendMCPRequest(port, message) {
  const response = await fetch(`http://localhost:${port}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * 測試工具函數：等待伺服器啟動
 */
async function waitForServer(port, maxRetries = 30, delay = 100) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // 伺服器還沒準備好，繼續等待
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error(`伺服器在 ${maxRetries * delay}ms 後仍未啟動`);
}

describe('MCP 伺服器整合測試 - 行為測試 (BDD)', () => {
  let server;
  const testPort = 3011; // 使用較高埠號避免衝突

  before(async () => {
    // Given: 啟動 MCP 伺服器
    try {
      server = await createMCPServer({
        httpMode: true,
        port: testPort
      });

      // 等待伺服器完全啟動
      await waitForServer(testPort);
    } catch (error) {
      console.error('伺服器啟動失敗:', error);
      throw error;
    }
  });

  after(async () => {
    // 清理：關閉伺服器
    if (server && typeof server.close === 'function') {
      try {
        await server.close();
        // 等待伺服器完全關閉
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('伺服器關閉失敗:', error);
      }
    }
  });

  describe('場景 1: MCP 協議初始化流程', () => {
    it('Given: MCP 客戶端連接, When: 發送 initialize 請求, Then: 返回正確的 capabilities', async () => {
      // Given: 準備初始化請求
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      // When: 發送初始化請求
      const response = await sendMCPRequest(testPort, initRequest);

      // Then: 驗證回應格式
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 1);
      assert.ok(response.result, '應該有 result 欄位');

      // Then: 驗證協議版本
      assert.strictEqual(
        response.result.protocolVersion,
        '2024-11-05',
        '協議版本應該正確'
      );

      // Then: 驗證 capabilities
      assert.ok(response.result.capabilities, '應該有 capabilities 欄位');
      assert.ok(response.result.capabilities.tools, '應該支援 tools capability');

      // Then: 驗證伺服器資訊
      assert.ok(response.result.serverInfo, '應該有 serverInfo 欄位');
      assert.strictEqual(
        response.result.serverInfo.name,
        'kubernetes-mcp-server',
        '伺服器名稱應該正確'
      );
      assert.strictEqual(
        response.result.serverInfo.version,
        '1.0.0',
        '伺服器版本應該正確'
      );
    });

    it('Given: 已初始化連接, When: 發送 initialized 通知, Then: 返回確認回應', async () => {
      // Given: 發送初始化請求（前置條件）
      const initRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      await sendMCPRequest(testPort, initRequest);

      // When: 發送 initialized 通知（帶 id，為了相容性）
      const initializedNotification = {
        jsonrpc: '2.0',
        id: 3,
        method: 'notifications/initialized',
        params: {}
      };

      const response = await sendMCPRequest(testPort, initializedNotification);

      // Then: 驗證回應（伺服器應該確認通知）
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.ok(response.result !== undefined, '應該有 result 欄位');
    });
  });

  describe('場景 2: 工具列表查詢流程', () => {
    it('Given: 已初始化的 MCP 連接, When: 發送 tools/list 請求, Then: 返回所有工具定義', async () => {
      // Given: 準備工具列表請求
      const toolsListRequest = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/list',
        params: {}
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, toolsListRequest);

      // Then: 驗證回應格式
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 10);
      assert.ok(response.result, '應該有 result 欄位');
      assert.ok(response.result.tools, '應該有 tools 陣列');

      // Then: 驗證工具數量（根據實際實作）
      assert.ok(response.result.tools.length >= 17, '應該至少有 17 個工具');

      // Then: 驗證工具結構
      const firstTool = response.result.tools[0];
      assert.ok(firstTool.name, '工具應該有 name 欄位');
      assert.ok(firstTool.description, '工具應該有 description 欄位');
      assert.ok(firstTool.inputSchema, '工具應該有 inputSchema 欄位');

      // Then: 驗證 inputSchema 結構
      assert.strictEqual(
        firstTool.inputSchema.type,
        'object',
        'inputSchema 應該是 object 類型'
      );
      assert.ok(
        firstTool.inputSchema.properties,
        'inputSchema 應該有 properties 欄位'
      );
    });

    it('Given: 已初始化連接, When: 查詢工具列表, Then: 包含所有必要的 kubectl 工具', async () => {
      // Given: 準備請求
      const toolsListRequest = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/list',
        params: {}
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, toolsListRequest);

      // Then: 提取工具名稱列表
      const toolNames = response.result.tools.map(tool => tool.name);

      // Then: 驗證核心 kubectl 工具存在
      const expectedKubectlTools = [
        'kubectl_get',
        'kubectl_logs',
        'kubectl_describe',
        'kubectl_cluster_info',
        'kubectl_get_yaml'
      ];

      for (const toolName of expectedKubectlTools) {
        assert.ok(
          toolNames.includes(toolName),
          `應該包含工具: ${toolName}`
        );
      }
    });

    it('Given: 已初始化連接, When: 查詢工具列表, Then: 包含所有必要的 helm 工具', async () => {
      // Given: 準備請求
      const toolsListRequest = {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/list',
        params: {}
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, toolsListRequest);

      // Then: 提取工具名稱列表
      const toolNames = response.result.tools.map(tool => tool.name);

      // Then: 驗證 helm 工具存在
      const expectedHelmTools = [
        'helm_list',
        'helm_status',
        'helm_repo_list',
        'helm_get_values',
        'helm_history'
      ];

      for (const toolName of expectedHelmTools) {
        assert.ok(
          toolNames.includes(toolName),
          `應該包含工具: ${toolName}`
        );
      }
    });

    it('Given: 已初始化連接, When: 查詢工具列表, Then: 包含叢集管理工具', async () => {
      // Given: 準備請求
      const toolsListRequest = {
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/list',
        params: {}
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, toolsListRequest);

      // Then: 提取工具名稱列表
      const toolNames = response.result.tools.map(tool => tool.name);

      // Then: 驗證叢集管理工具存在
      assert.ok(
        toolNames.includes('cluster_list'),
        '應該包含 cluster_list 工具'
      );
      assert.ok(
        toolNames.includes('gke_auth'),
        '應該包含 gke_auth 工具'
      );
    });
  });

  describe('場景 3: 工具執行流程 - 基本測試', () => {
    it('Given: 有效的工具名稱, When: 發送 tools/call 請求, Then: 返回正確格式的回應', async () => {
      // Given: 準備工具執行請求（使用 kubectl_cluster_info，不需要參數）
      const toolCallRequest = {
        jsonrpc: '2.0',
        id: 20,
        method: 'tools/call',
        params: {
          name: 'kubectl_cluster_info',
          arguments: {}
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, toolCallRequest);

      // Then: 驗證回應格式
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 20);

      // Then: 驗證有 result 或 error（取決於 kubectl 是否可用）
      assert.ok(
        response.result || response.error,
        '應該有 result 或 error 欄位'
      );

      // 如果有 result，驗證其結構
      if (response.result) {
        assert.ok(response.result.content, '應該有 content 欄位');
        assert.ok(Array.isArray(response.result.content), 'content 應該是陣列');

        if (response.result.content.length > 0) {
          const firstContent = response.result.content[0];
          assert.strictEqual(firstContent.type, 'text', '內容類型應該是 text');
          assert.ok(firstContent.text, '應該有 text 欄位');
        }
      }
    });

    it('Given: helm_repo_list 工具, When: 執行工具, Then: 返回正確的內容結構', async () => {
      // Given: 準備 helm_repo_list 請求
      const toolCallRequest = {
        jsonrpc: '2.0',
        id: 21,
        method: 'tools/call',
        params: {
          name: 'helm_repo_list',
          arguments: {}
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, toolCallRequest);

      // Then: 驗證回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 21);

      // 驗證有回應（可能是成功或錯誤）
      assert.ok(
        response.result || response.error,
        '應該有 result 或 error'
      );

      // 如果成功，驗證結構
      if (response.result) {
        assert.ok(response.result.content, '應該有 content 欄位');
        assert.ok(Array.isArray(response.result.content), 'content 應該是陣列');
      }
    });

    it('Given: cluster_list 工具, When: 執行工具, Then: 返回叢集列表', async () => {
      // Given: 準備 cluster_list 請求
      const toolCallRequest = {
        jsonrpc: '2.0',
        id: 22,
        method: 'tools/call',
        params: {
          name: 'cluster_list',
          arguments: {}
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, toolCallRequest);

      // Then: 驗證回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 22);

      // 驗證有回應
      assert.ok(
        response.result || response.error,
        '應該有 result 或 error'
      );

      // 如果成功，驗證結構
      if (response.result) {
        assert.ok(response.result.content, '應該有 content 欄位');
      }
    });
  });

  describe('場景 4: 健康檢查和資訊端點', () => {
    it('Given: 執行中的伺服器, When: 訪問 /health, Then: 返回健康狀態', async () => {
      // When: 發送健康檢查請求
      const response = await fetch(`http://localhost:${testPort}/health`);

      // Then: 驗證 HTTP 狀態
      assert.strictEqual(response.status, 200, 'HTTP 狀態應該是 200');

      // Then: 驗證回應內容
      const data = await response.json();
      assert.strictEqual(data.status, 'healthy', '狀態應該是 healthy');
      assert.strictEqual(data.service, 'k8s-mcp-server', '服務名稱應該正確');
      assert.ok(data.timestamp, '應該有時間戳記');
    });

    it('Given: 執行中的伺服器, When: 訪問 /info, Then: 返回伺服器資訊', async () => {
      // When: 發送資訊請求
      const response = await fetch(`http://localhost:${testPort}/info`);

      // Then: 驗證回應
      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.strictEqual(data.name, 'kubernetes-mcp-server');
      assert.strictEqual(data.version, '1.0.0');
      assert.strictEqual(data.protocolVersion, '2024-11-05');

      // 驗證支援的傳輸方式
      assert.ok(Array.isArray(data.transports), 'transports 應該是陣列');
      assert.ok(data.transports.includes('sse'), '應該支援 SSE');
      assert.ok(data.transports.includes('streamable_http'), '應該支援 Streamable HTTP');
    });

    it('Given: 執行中的伺服器, When: 訪問 /tools, Then: 返回工具列表', async () => {
      // When: 發送工具列表請求
      const response = await fetch(`http://localhost:${testPort}/tools`);

      // Then: 驗證回應
      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.strictEqual(data.jsonrpc, '2.0');
      assert.ok(data.result, '應該有 result 欄位');
      assert.ok(data.result.tools, '應該有 tools 陣列');
      assert.ok(data.result.tools.length >= 17, '應該有足夠的工具');
    });
  });

  describe('場景 5: Ping 健康檢查', () => {
    it('Given: 活躍的 MCP 連接, When: 發送 ping 請求, Then: 返回 pong 回應', async () => {
      // Given: 準備 ping 請求
      const pingRequest = {
        jsonrpc: '2.0',
        id: 30,
        method: 'ping',
        params: {}
      };

      // When: 發送 ping
      const response = await sendMCPRequest(testPort, pingRequest);

      // Then: 驗證回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 30);
      assert.ok(response.result, '應該有 result 欄位');
      assert.strictEqual(response.result.status, 'pong', '狀態應該是 pong');
      assert.ok(response.result.timestamp, '應該有時間戳記');
      assert.strictEqual(
        response.result.server,
        'kubernetes-mcp-server',
        '伺服器名稱應該正確'
      );
    });
  });

  describe('場景 6: 可選的 MCP 方法', () => {
    it('Given: MCP 連接, When: 請求 resources/list, Then: 返回資源列表（可為空）', async () => {
      // Given: 準備 resources/list 請求
      const resourcesRequest = {
        jsonrpc: '2.0',
        id: 40,
        method: 'resources/list',
        params: {}
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, resourcesRequest);

      // Then: 驗證回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 40);
      assert.ok(response.result, '應該有 result 欄位');
      assert.ok(response.result.resources, '應該有 resources 欄位');
      assert.ok(Array.isArray(response.result.resources), 'resources 應該是陣列');
    });

    it('Given: MCP 連接, When: 請求 prompts/list, Then: 返回提示列表（可為空）', async () => {
      // Given: 準備 prompts/list 請求
      const promptsRequest = {
        jsonrpc: '2.0',
        id: 41,
        method: 'prompts/list',
        params: {}
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, promptsRequest);

      // Then: 驗證回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 41);
      assert.ok(response.result, '應該有 result 欄位');
      assert.ok(response.result.prompts, '應該有 prompts 欄位');
      assert.ok(Array.isArray(response.result.prompts), 'prompts 應該是陣列');
    });
  });

  describe('場景 7: 完整的 MCP 生命週期', () => {
    it('Given: 新客戶端, When: 執行完整初始化流程, Then: 成功執行工具', async () => {
      // Step 1: Initialize
      const initRequest = {
        jsonrpc: '2.0',
        id: 50,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'integration-test-client',
            version: '1.0.0'
          }
        }
      };

      const initResponse = await sendMCPRequest(testPort, initRequest);
      assert.strictEqual(initResponse.result.protocolVersion, '2024-11-05');

      // Step 2: Send initialized notification
      const initializedNotification = {
        jsonrpc: '2.0',
        id: 51,
        method: 'notifications/initialized',
        params: {}
      };

      await sendMCPRequest(testPort, initializedNotification);

      // Step 3: List tools
      const toolsListRequest = {
        jsonrpc: '2.0',
        id: 52,
        method: 'tools/list',
        params: {}
      };

      const toolsResponse = await sendMCPRequest(testPort, toolsListRequest);
      assert.ok(toolsResponse.result.tools.length > 0, '應該有可用的工具');

      // Step 4: Execute a tool
      const toolCallRequest = {
        jsonrpc: '2.0',
        id: 53,
        method: 'tools/call',
        params: {
          name: 'kubectl_cluster_info',
          arguments: {}
        }
      };

      const toolResponse = await sendMCPRequest(testPort, toolCallRequest);
      assert.ok(
        toolResponse.result || toolResponse.error,
        '工具執行應該有回應'
      );
    });
  });
});
