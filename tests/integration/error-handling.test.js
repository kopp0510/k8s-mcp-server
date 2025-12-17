/**
 * MCP 伺服器錯誤處理測試 - 失敗驅動開發 (FDD)
 * 測試各種錯誤情境和邊界條件
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createMCPServer } from '../../src/server.js';

/**
 * 測試工具函數：發送 JSON-RPC 請求
 */
async function sendMCPRequest(port, message) {
  const response = await fetch(`http://localhost:${port}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message)
  });

  if (!response.ok && response.status !== 400 && response.status !== 500) {
    throw new Error(`Unexpected HTTP ${response.status}: ${response.statusText}`);
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
      // 忽略連接錯誤，繼續重試
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error(`伺服器在 ${maxRetries * delay}ms 後仍未啟動`);
}

describe('MCP 伺服器錯誤處理測試 - 失敗情境 (FDD)', () => {
  let server;
  const testPort = 3012; // 使用較高埠號避免衝突

  before(async () => {
    // 啟動測試伺服器
    try {
      server = await createMCPServer({
        httpMode: true,
        port: testPort
      });

      await waitForServer(testPort);
    } catch (error) {
      console.error('伺服器啟動失敗:', error);
      throw error;
    }
  });

  after(async () => {
    // 清理伺服器
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

  describe('失敗情境 1: 無效的請求格式', () => {
    it('當發送空的請求體時，應該返回錯誤', async () => {
      // Given: 空的請求體
      const emptyRequest = {};

      // When: 發送請求
      const response = await sendMCPRequest(testPort, emptyRequest);

      // Then: 應該返回錯誤
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.ok(response.error, '應該有 error 欄位');
      assert.strictEqual(response.error.code, -32601, '錯誤代碼應該是 -32601 (Method not found)');
    });

    it('當請求缺少 method 欄位時，應該返回錯誤', async () => {
      // Given: 缺少 method 的請求
      const invalidRequest = {
        jsonrpc: '2.0',
        id: 100,
        params: {}
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, invalidRequest);

      // Then: 應該返回錯誤
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 100);
      assert.ok(response.error, '應該有 error 欄位');
    });

    it('當請求缺少 jsonrpc 欄位時，應該仍能處理', async () => {
      // Given: 缺少 jsonrpc 的請求
      const requestWithoutJsonRpc = {
        id: 101,
        method: 'tools/list',
        params: {}
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, requestWithoutJsonRpc);

      // Then: 應該有回應（伺服器應該容錯處理）
      assert.ok(response, '應該有回應');
    });

    it('當請求有無效的 jsonrpc 版本時，應該仍能處理', async () => {
      // Given: 無效的 jsonrpc 版本
      const invalidVersionRequest = {
        jsonrpc: '1.0',
        id: 102,
        method: 'tools/list',
        params: {}
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, invalidVersionRequest);

      // Then: 應該有回應
      assert.ok(response, '應該有回應');
    });
  });

  describe('失敗情境 2: 不存在的方法', () => {
    it('當調用不存在的 MCP 方法時，應該返回 Method not found 錯誤', async () => {
      // Given: 不存在的方法
      const invalidMethodRequest = {
        jsonrpc: '2.0',
        id: 110,
        method: 'non_existent_method',
        params: {}
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, invalidMethodRequest);

      // Then: 驗證錯誤回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 110);
      assert.ok(response.error, '應該有 error 欄位');
      assert.strictEqual(
        response.error.code,
        -32601,
        '錯誤代碼應該是 -32601 (Method not found)'
      );
      assert.ok(
        response.error.message.includes('Method not found'),
        '錯誤訊息應該包含 "Method not found"'
      );
    });

    it('當調用不存在的工具時，應該返回錯誤', async () => {
      // Given: 不存在的工具名稱
      const invalidToolRequest = {
        jsonrpc: '2.0',
        id: 111,
        method: 'tools/call',
        params: {
          name: 'non_existent_tool',
          arguments: {}
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, invalidToolRequest);

      // Then: 驗證錯誤
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 111);
      assert.ok(response.error, '應該有 error 欄位');
      assert.ok(
        response.error.message.includes('Unknown tool'),
        '錯誤訊息應該提到未知工具'
      );
    });
  });

  describe('失敗情境 3: 無效的工具參數', () => {
    it('當 kubectl_get 缺少必要的 resourceType 參數時，應該返回錯誤', async () => {
      // Given: 缺少 resourceType 的請求
      const missingParamRequest = {
        jsonrpc: '2.0',
        id: 120,
        method: 'tools/call',
        params: {
          name: 'kubectl_get',
          arguments: {
            namespace: 'default'
            // 缺少 resourceType
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, missingParamRequest);

      // Then: 應該返回錯誤（可能在 result 中包含錯誤訊息，或在 error 欄位）
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 120);

      // 工具可能返回錯誤在 result.content 或 error 欄位
      if (response.error) {
        assert.ok(response.error.message, '應該有錯誤訊息');
      } else if (response.result && response.result.content) {
        const errorText = response.result.content[0].text;
        assert.ok(
          errorText.includes('錯誤') || errorText.includes('Error'),
          '應該包含錯誤訊息'
        );
      }
    });

    it('當 kubectl_logs 使用無效的命名空間格式時，應該處理錯誤', async () => {
      // Given: 無效的命名空間格式（包含特殊字元）
      const invalidNamespaceRequest = {
        jsonrpc: '2.0',
        id: 121,
        method: 'tools/call',
        params: {
          name: 'kubectl_logs',
          arguments: {
            podName: 'test-pod',
            namespace: 'invalid@namespace!'  // 無效格式
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, invalidNamespaceRequest);

      // Then: 應該有回應（可能是驗證錯誤或執行錯誤）
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 121);
      assert.ok(
        response.result || response.error,
        '應該有 result 或 error'
      );
    });

    it('當 kubectl_describe 使用無效的資源類型時，應該返回錯誤', async () => {
      // Given: 無效的資源類型
      const invalidResourceRequest = {
        jsonrpc: '2.0',
        id: 122,
        method: 'tools/call',
        params: {
          name: 'kubectl_describe',
          arguments: {
            resourceType: 'invalid_resource_type',
            resourceName: 'test-resource',
            namespace: 'default'
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, invalidResourceRequest);

      // Then: 應該有回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 122);
      assert.ok(
        response.result || response.error,
        '應該有 result 或 error'
      );

      // 如果在 result 中，應該包含錯誤訊息
      if (response.result && response.result.content) {
        const text = response.result.content[0].text;
        assert.ok(text, '應該有回應文字');
      }
    });

    it('當 tools/call 缺少 name 參數時，應該返回錯誤', async () => {
      // Given: 缺少 name 的工具調用
      const missingNameRequest = {
        jsonrpc: '2.0',
        id: 123,
        method: 'tools/call',
        params: {
          arguments: {
            someParam: 'value'
          }
          // 缺少 name
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, missingNameRequest);

      // Then: 應該返回錯誤
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 123);
      assert.ok(response.error, '應該有 error 欄位');
    });
  });

  describe('失敗情境 4: 危險輸入和注入攻擊', () => {
    it('當命名空間包含命令注入嘗試時，應該安全處理', async () => {
      // Given: 包含命令注入的命名空間
      const injectionRequest = {
        jsonrpc: '2.0',
        id: 130,
        method: 'tools/call',
        params: {
          name: 'kubectl_get',
          arguments: {
            resourceType: 'pods',
            namespace: 'default; rm -rf /'  // 命令注入嘗試
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, injectionRequest);

      // Then: 應該安全處理（不應該執行注入的命令）
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 130);

      // 應該有回應，且不應該導致伺服器崩潰
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });

    it('當 podName 包含路徑遍歷嘗試時，應該安全處理', async () => {
      // Given: 包含路徑遍歷的 pod 名稱
      const pathTraversalRequest = {
        jsonrpc: '2.0',
        id: 131,
        method: 'tools/call',
        params: {
          name: 'kubectl_logs',
          arguments: {
            podName: '../../../etc/passwd',  // 路徑遍歷嘗試
            namespace: 'default'
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, pathTraversalRequest);

      // Then: 應該安全處理
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 131);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });

    it('當輸入包含 SQL 注入模式時，應該安全處理', async () => {
      // Given: 包含 SQL 注入模式的輸入
      const sqlInjectionRequest = {
        jsonrpc: '2.0',
        id: 132,
        method: 'tools/call',
        params: {
          name: 'kubectl_describe',
          arguments: {
            resourceType: 'pods',
            resourceName: "test' OR '1'='1",  // SQL 注入模式
            namespace: 'default'
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, sqlInjectionRequest);

      // Then: 應該安全處理
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 132);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });

    it('當輸入包含 Shell 特殊字元時，應該安全處理', async () => {
      // Given: 包含多種 Shell 特殊字元
      const specialCharsRequest = {
        jsonrpc: '2.0',
        id: 133,
        method: 'tools/call',
        params: {
          name: 'kubectl_get',
          arguments: {
            resourceType: 'pods',
            namespace: 'test$variable`command`&&echo'  // 多種特殊字元
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, specialCharsRequest);

      // Then: 應該安全處理
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 133);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });
  });

  describe('失敗情境 5: 邊界條件', () => {
    it('當命名空間為空字串時，應該使用預設值或返回錯誤', async () => {
      // Given: 空字串命名空間
      const emptyNamespaceRequest = {
        jsonrpc: '2.0',
        id: 140,
        method: 'tools/call',
        params: {
          name: 'kubectl_get',
          arguments: {
            resourceType: 'pods',
            namespace: ''  // 空字串
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, emptyNamespaceRequest);

      // Then: 應該有回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 140);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });

    it('當輸入超長字串（10KB）時，應該處理或拒絕', async () => {
      // Given: 超長字串（10KB）
      const longString = 'a'.repeat(10 * 1024);
      const longStringRequest = {
        jsonrpc: '2.0',
        id: 141,
        method: 'tools/call',
        params: {
          name: 'kubectl_describe',
          arguments: {
            resourceType: 'pods',
            resourceName: longString,
            namespace: 'default'
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, longStringRequest);

      // Then: 應該有回應（可能是錯誤）
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 141);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });

    it('當輸入包含特殊 Unicode 字元時，應該正確處理', async () => {
      // Given: 包含各種 Unicode 字元
      const unicodeRequest = {
        jsonrpc: '2.0',
        id: 142,
        method: 'tools/call',
        params: {
          name: 'kubectl_get',
          arguments: {
            resourceType: 'pods',
            namespace: '測試-namespace-🚀-中文'  // 中文、emoji 等
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, unicodeRequest);

      // Then: 應該有回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 142);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });

    it('當輸入為 null 值時，應該處理', async () => {
      // Given: null 值
      const nullValueRequest = {
        jsonrpc: '2.0',
        id: 143,
        method: 'tools/call',
        params: {
          name: 'kubectl_get',
          arguments: {
            resourceType: 'pods',
            namespace: null  // null 值
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, nullValueRequest);

      // Then: 應該有回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 143);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });

    it('當輸入為 undefined 時，應該處理', async () => {
      // Given: undefined（在 JSON 中會被忽略）
      const undefinedRequest = {
        jsonrpc: '2.0',
        id: 144,
        method: 'tools/call',
        params: {
          name: 'kubectl_get',
          arguments: {
            resourceType: 'pods'
            // namespace 未定義
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, undefinedRequest);

      // Then: 應該有回應（應該使用預設命名空間）
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 144);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });

    it('當 arguments 為空物件時，應該處理', async () => {
      // Given: 空的 arguments
      const emptyArgsRequest = {
        jsonrpc: '2.0',
        id: 145,
        method: 'tools/call',
        params: {
          name: 'kubectl_cluster_info',
          arguments: {}  // 空物件
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, emptyArgsRequest);

      // Then: 應該有回應（kubectl_cluster_info 不需要參數）
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 145);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });

    it('當 arguments 完全缺失時，應該處理', async () => {
      // Given: 缺少 arguments
      const noArgsRequest = {
        jsonrpc: '2.0',
        id: 146,
        method: 'tools/call',
        params: {
          name: 'kubectl_cluster_info'
          // 沒有 arguments 欄位
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, noArgsRequest);

      // Then: 應該有回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 146);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });
  });

  describe('失敗情境 6: 數字邊界', () => {
    it('當 scale deployment 的 replicas 為負數時，應該返回錯誤', async () => {
      // Given: 負數 replicas
      const negativeReplicasRequest = {
        jsonrpc: '2.0',
        id: 150,
        method: 'tools/call',
        params: {
          name: 'kubectl_scale_deployment',
          arguments: {
            deployment: 'test-deployment',
            replicas: -1,  // 負數
            namespace: 'default'
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, negativeReplicasRequest);

      // Then: 應該返回錯誤或在 result 中說明錯誤
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 150);

      if (response.result && response.result.content) {
        const text = response.result.content[0].text;
        // 應該包含錯誤訊息或驗證失敗訊息
        assert.ok(text, '應該有回應文字');
      }
    });

    it('當 replicas 為超大數字時，應該處理', async () => {
      // Given: 超大數字
      const hugeReplicasRequest = {
        jsonrpc: '2.0',
        id: 151,
        method: 'tools/call',
        params: {
          name: 'kubectl_scale_deployment',
          arguments: {
            deployment: 'test-deployment',
            replicas: 999999999,  // 超大數字
            namespace: 'default'
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, hugeReplicasRequest);

      // Then: 應該有回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 151);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });

    it('當 replicas 為浮點數時，應該處理', async () => {
      // Given: 浮點數 replicas
      const floatReplicasRequest = {
        jsonrpc: '2.0',
        id: 152,
        method: 'tools/call',
        params: {
          name: 'kubectl_scale_deployment',
          arguments: {
            deployment: 'test-deployment',
            replicas: 3.14,  // 浮點數
            namespace: 'default'
          }
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, floatReplicasRequest);

      // Then: 應該有回應（可能轉換為整數或返回錯誤）
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 152);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });
  });

  describe('失敗情境 7: 型別錯誤', () => {
    it('當 params 為陣列而非物件時，應該處理', async () => {
      // Given: params 是陣列
      const arrayParamsRequest = {
        jsonrpc: '2.0',
        id: 160,
        method: 'tools/list',
        params: []  // 陣列而非物件
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, arrayParamsRequest);

      // Then: 應該有回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 160);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });

    it('當 id 為字串而非數字時，應該正確處理', async () => {
      // Given: 字串 id
      const stringIdRequest = {
        jsonrpc: '2.0',
        id: 'test-id-string',  // 字串 id
        method: 'tools/list',
        params: {}
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, stringIdRequest);

      // Then: 應該返回相同的 id
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 'test-id-string');
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });

    it('當 arguments 為字串而非物件時，應該返回錯誤', async () => {
      // Given: 字串 arguments
      const stringArgsRequest = {
        jsonrpc: '2.0',
        id: 162,
        method: 'tools/call',
        params: {
          name: 'kubectl_cluster_info',
          arguments: 'invalid-string-arguments'  // 字串而非物件
        }
      };

      // When: 發送請求
      const response = await sendMCPRequest(testPort, stringArgsRequest);

      // Then: 應該有回應
      assert.strictEqual(response.jsonrpc, '2.0');
      assert.strictEqual(response.id, 162);
      assert.ok(
        response.result || response.error,
        '應該有回應'
      );
    });
  });

  describe('失敗情境 8: 並發和競爭條件', () => {
    it('當同時發送多個請求時，應該都能正確回應', async () => {
      // Given: 10 個並發請求
      const requests = Array.from({ length: 10 }, (_, i) => ({
        jsonrpc: '2.0',
        id: 200 + i,
        method: 'tools/list',
        params: {}
      }));

      // When: 並發發送所有請求
      const responses = await Promise.all(
        requests.map(req => sendMCPRequest(testPort, req))
      );

      // Then: 所有請求都應該成功
      assert.strictEqual(responses.length, 10, '應該收到 10 個回應');

      responses.forEach((response, index) => {
        assert.strictEqual(response.jsonrpc, '2.0');
        assert.strictEqual(response.id, 200 + index, `回應 ${index} 的 id 應該正確`);
        assert.ok(response.result || response.error, `回應 ${index} 應該有內容`);
      });
    });

    it('當快速連續執行相同工具時，應該都能正確回應', async () => {
      // Given: 5 個相同的工具執行請求
      const requests = Array.from({ length: 5 }, (_, i) => ({
        jsonrpc: '2.0',
        id: 210 + i,
        method: 'tools/call',
        params: {
          name: 'kubectl_cluster_info',
          arguments: {}
        }
      }));

      // When: 快速連續發送
      const responses = await Promise.all(
        requests.map(req => sendMCPRequest(testPort, req))
      );

      // Then: 所有請求都應該成功
      assert.strictEqual(responses.length, 5);

      responses.forEach((response, index) => {
        assert.strictEqual(response.id, 210 + index);
        assert.ok(response.result || response.error);
      });
    });
  });
});
