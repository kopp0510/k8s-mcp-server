/**
 * 基本煙霧測試 - 驗證伺服器能正常啟動和響應
 * 這是最基本的整合測試，確保核心功能正常
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createMCPServer } from '../../src/server.js';

/**
 * 發送 HTTP 請求的輔助函數
 */
async function sendRequest(port, path, options = {}) {
  const url = `http://localhost:${port}${path}`;
  const response = await fetch(url, options);
  return response;
}

/**
 * 等待伺服器啟動
 */
async function waitForServer(port, maxAttempts = 20, delayMs = 100) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // 忽略連接錯誤，繼續重試
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error(`伺服器在 ${maxAttempts * delayMs}ms 內未能啟動`);
}

describe('MCP 伺服器煙霧測試', () => {
  let server;
  const testPort = 3010; // 使用較高的埠號避免衝突

  before(async () => {
    console.log(`\n開始啟動測試伺服器於埠 ${testPort}...`);

    try {
      // 創建並啟動伺服器
      server = await createMCPServer({
        httpMode: true,
        port: testPort
      });

      console.log('伺服器創建成功，等待啟動完成...');

      // 等待伺服器完全啟動
      await waitForServer(testPort);

      console.log('伺服器啟動完成並可接受請求\n');
    } catch (error) {
      console.error('伺服器啟動失敗:', error.message);
      throw error;
    }
  });

  after(async () => {
    console.log('\n開始關閉測試伺服器...');

    if (server && typeof server.close === 'function') {
      try {
        await server.close();
        console.log('伺服器關閉成功');

        // 等待埠號釋放
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('伺服器關閉失敗:', error.message);
      }
    }
  });

  it('伺服器應該成功啟動', () => {
    assert.ok(server, '伺服器實例應該存在');
    assert.ok(typeof server.close === 'function', '伺服器應該有 close 方法');
  });

  it('健康檢查端點應該返回 200', async () => {
    const response = await sendRequest(testPort, '/health');

    assert.strictEqual(response.status, 200, 'HTTP 狀態應該是 200');

    const data = await response.json();
    assert.ok(data, '應該有回應資料');
    assert.strictEqual(data.status, 'healthy', '狀態應該是 healthy');
    assert.strictEqual(data.service, 'k8s-mcp-server', '服務名稱應該正確');
  });

  it('MCP 端點應該可以訪問', async () => {
    const response = await sendRequest(testPort, '/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'smoke-test',
            version: '1.0.0'
          }
        }
      })
    });

    assert.strictEqual(response.status, 200, 'MCP 端點應該返回 200');

    const data = await response.json();
    assert.strictEqual(data.jsonrpc, '2.0', 'JSON-RPC 版本應該正確');
    assert.strictEqual(data.id, 1, '回應 ID 應該正確');
    assert.ok(data.result, '應該有 result 欄位');
    assert.ok(data.result.capabilities, '應該有 capabilities');
  });

  it('工具列表應該可以查詢', async () => {
    const response = await sendRequest(testPort, '/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      })
    });

    assert.strictEqual(response.status, 200, '工具列表端點應該返回 200');

    const data = await response.json();
    assert.ok(data.result, '應該有 result 欄位');
    assert.ok(Array.isArray(data.result.tools), 'tools 應該是陣列');
    assert.ok(data.result.tools.length >= 17, `應該有至少 17 個工具，實際有 ${data.result.tools.length} 個`);
  });

  it('info 端點應該返回伺服器資訊', async () => {
    const response = await sendRequest(testPort, '/info');

    assert.strictEqual(response.status, 200, 'info 端點應該返回 200');

    const data = await response.json();
    assert.strictEqual(data.name, 'kubernetes-mcp-server', '伺服器名稱應該正確');
    assert.strictEqual(data.version, '1.0.0', '版本應該正確');
    assert.strictEqual(data.protocolVersion, '2024-11-05', '協議版本應該正確');
    assert.ok(Array.isArray(data.transports), 'transports 應該是陣列');
  });
});
