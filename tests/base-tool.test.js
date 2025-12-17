import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { BaseTool, PrerequisiteError } from '../src/tools/base-tool.js';

// 建立測試用的具體工具類別
class TestTool extends BaseTool {
  constructor() {
    super('test-tool', 'A test tool for testing');
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
            description: 'Cluster ID'
          },
          namespace: {
            type: 'string',
            description: 'Namespace'
          }
        }
      }
    };
  }

  async execute(args) {
    return this.createSuccessResponse('Test execution successful');
  }
}

describe('PrerequisiteError', () => {
  it('應該正確建立 PrerequisiteError 實例', () => {
    const error = new PrerequisiteError('Test error', 'my-cluster', 'test-tool');

    assert.strictEqual(error.message, 'Test error');
    assert.strictEqual(error.name, 'PrerequisiteError');
    assert.strictEqual(error.cluster, 'my-cluster');
    assert.strictEqual(error.tool, 'test-tool');
    assert.strictEqual(error.shouldStopWorkflow, true);
  });

  it('應該繼承自 Error', () => {
    const error = new PrerequisiteError('Test error', 'cluster', 'tool');
    assert.ok(error instanceof Error);
    assert.ok(error instanceof PrerequisiteError);
  });

  it('應該包含 stack trace', () => {
    const error = new PrerequisiteError('Test error', 'cluster', 'tool');
    assert.ok(error.stack);
    assert.ok(error.stack.includes('PrerequisiteError'));
  });
});

describe('BaseTool - constructor', () => {
  it('應該正確初始化工具名稱和描述', () => {
    const tool = new TestTool();

    assert.strictEqual(tool.name, 'test-tool');
    assert.strictEqual(tool.description, 'A test tool for testing');
  });
});

describe('BaseTool - getDefinition', () => {
  it('基礎類別應該拋出錯誤', () => {
    const baseTool = new BaseTool('base', 'base tool');

    assert.throws(
      () => baseTool.getDefinition(),
      { message: 'Subclasses must implement getDefinition method' }
    );
  });

  it('子類別應該正確實作 getDefinition', () => {
    const tool = new TestTool();
    const definition = tool.getDefinition();

    assert.strictEqual(definition.name, 'test-tool');
    assert.strictEqual(definition.description, 'A test tool for testing');
    assert.ok(definition.inputSchema);
    assert.strictEqual(definition.inputSchema.type, 'object');
  });
});

describe('BaseTool - execute', () => {
  it('基礎類別應該拋出錯誤', async () => {
    const baseTool = new BaseTool('base', 'base tool');

    await assert.rejects(
      async () => await baseTool.execute({}),
      { message: 'Subclasses must implement execute method' }
    );
  });

  it('子類別應該正確實作 execute', async () => {
    const tool = new TestTool();
    const result = await tool.execute({});

    assert.ok(result);
    assert.ok(result.content);
    assert.strictEqual(result.content[0].type, 'text');
  });
});

describe('BaseTool - createResponse', () => {
  it('應該建立正常回應', () => {
    const tool = new TestTool();
    const response = tool.createResponse('Test message');

    assert.deepStrictEqual(response, {
      content: [
        {
          type: 'text',
          text: 'Test message'
        }
      ]
    });
  });

  it('應該建立錯誤回應', () => {
    const tool = new TestTool();
    const response = tool.createResponse('Error message', true);

    assert.deepStrictEqual(response, {
      content: [
        {
          type: 'text',
          text: 'Error message'
        }
      ],
      isError: true
    });
  });

  it('應該處理空字串', () => {
    const tool = new TestTool();
    const response = tool.createResponse('');

    assert.strictEqual(response.content[0].text, '');
    assert.strictEqual(response.isError, undefined);
  });

  it('應該處理多行文字', () => {
    const tool = new TestTool();
    const multilineText = 'Line 1\nLine 2\nLine 3';
    const response = tool.createResponse(multilineText);

    assert.strictEqual(response.content[0].text, multilineText);
  });
});

describe('BaseTool - createErrorResponse', () => {
  it('應該建立錯誤回應（預設 isError=true）', () => {
    const tool = new TestTool();
    const response = tool.createErrorResponse('Something went wrong');

    assert.deepStrictEqual(response, {
      content: [
        {
          type: 'text',
          text: 'Error: Something went wrong'
        }
      ],
      isError: true
    });
  });

  it('應該在訊息前加上 "Error:" 前綴', () => {
    const tool = new TestTool();
    const response = tool.createErrorResponse('Connection failed');

    assert.ok(response.content[0].text.startsWith('Error: '));
    assert.strictEqual(response.content[0].text, 'Error: Connection failed');
  });

  it('應該允許覆寫 isError 參數', () => {
    const tool = new TestTool();
    const response = tool.createErrorResponse('Warning message', false);

    assert.strictEqual(response.isError, false);
    assert.strictEqual(response.content[0].text, 'Error: Warning message');
  });

  it('應該處理空錯誤訊息', () => {
    const tool = new TestTool();
    const response = tool.createErrorResponse('');

    assert.strictEqual(response.content[0].text, 'Error: ');
    assert.strictEqual(response.isError, true);
  });
});

describe('BaseTool - createSuccessResponse', () => {
  it('應該建立成功回應（預設 type="text"）', () => {
    const tool = new TestTool();
    const response = tool.createSuccessResponse('Operation completed');

    assert.deepStrictEqual(response, {
      content: [
        {
          type: 'text',
          text: 'Operation completed'
        }
      ]
    });
  });

  it('應該允許自訂內容類型', () => {
    const tool = new TestTool();
    const response = tool.createSuccessResponse('{"status": "ok"}', 'json');

    assert.strictEqual(response.content[0].type, 'json');
    assert.strictEqual(response.content[0].text, '{"status": "ok"}');
  });

  it('應該處理空字串', () => {
    const tool = new TestTool();
    const response = tool.createSuccessResponse('');

    assert.strictEqual(response.content[0].text, '');
    assert.strictEqual(response.content[0].type, 'text');
  });

  it('應該處理長文字內容', () => {
    const tool = new TestTool();
    const longText = 'x'.repeat(10000);
    const response = tool.createSuccessResponse(longText);

    assert.strictEqual(response.content[0].text.length, 10000);
    assert.strictEqual(response.content[0].type, 'text');
  });

  it('應該處理 YAML 類型', () => {
    const tool = new TestTool();
    const yamlContent = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
`;
    const response = tool.createSuccessResponse(yamlContent, 'yaml');

    assert.strictEqual(response.content[0].type, 'yaml');
    assert.strictEqual(response.content[0].text, yamlContent);
  });
});

describe('BaseTool - validateArgs', () => {
  it('應該返回 true（預設實作）', () => {
    const tool = new TestTool();
    const result = tool.validateArgs({ cluster: 'test' }, {});

    assert.strictEqual(result, true);
  });

  it('應該接受任何參數', () => {
    const tool = new TestTool();

    assert.strictEqual(tool.validateArgs({}, {}), true);
    assert.strictEqual(tool.validateArgs({ a: 1, b: 2 }, {}), true);
    assert.strictEqual(tool.validateArgs(null, null), true);
  });
});

describe('BaseTool - 回應格式一致性', () => {
  it('所有回應方法應該返回相同的結構', () => {
    const tool = new TestTool();

    const response1 = tool.createResponse('test');
    const response2 = tool.createErrorResponse('error');
    const response3 = tool.createSuccessResponse('success');

    // 所有回應都應該有 content 陣列
    assert.ok(Array.isArray(response1.content));
    assert.ok(Array.isArray(response2.content));
    assert.ok(Array.isArray(response3.content));

    // 所有 content 項目都應該有 type 和 text
    assert.strictEqual(response1.content[0].type, 'text');
    assert.strictEqual(response2.content[0].type, 'text');
    assert.strictEqual(response3.content[0].type, 'text');

    assert.ok('text' in response1.content[0]);
    assert.ok('text' in response2.content[0]);
    assert.ok('text' in response3.content[0]);
  });

  it('錯誤回應應該包含 isError 旗標', () => {
    const tool = new TestTool();

    const errorResponse1 = tool.createResponse('error', true);
    const errorResponse2 = tool.createErrorResponse('error');

    assert.strictEqual(errorResponse1.isError, true);
    assert.strictEqual(errorResponse2.isError, true);
  });

  it('正常回應不應該包含 isError 旗標（或為 undefined）', () => {
    const tool = new TestTool();

    const normalResponse = tool.createResponse('normal');
    const successResponse = tool.createSuccessResponse('success');

    assert.strictEqual(normalResponse.isError, undefined);
    assert.strictEqual(successResponse.isError, undefined);
  });
});

describe('BaseTool - 邊界條件測試', () => {
  it('應該處理 null 和 undefined 值', () => {
    const tool = new TestTool();

    assert.doesNotThrow(() => tool.createResponse(null));
    assert.doesNotThrow(() => tool.createResponse(undefined));
    assert.doesNotThrow(() => tool.createSuccessResponse(null));
    assert.doesNotThrow(() => tool.createSuccessResponse(undefined));
  });

  it('應該處理包含特殊字元的訊息', () => {
    const tool = new TestTool();
    const specialChars = 'Test\n\r\t\b\f\'\"\\\u0000';
    const response = tool.createResponse(specialChars);

    assert.ok(response.content[0].text);
  });

  it('應該處理非常長的訊息', () => {
    const tool = new TestTool();
    const longMessage = 'a'.repeat(100000);
    const response = tool.createSuccessResponse(longMessage);

    assert.strictEqual(response.content[0].text.length, 100000);
  });

  it('應該處理 Unicode 字元', () => {
    const tool = new TestTool();
    const unicodeText = '測試 🎉 Unicode テスト 📝';
    const response = tool.createResponse(unicodeText);

    assert.strictEqual(response.content[0].text, unicodeText);
  });

  it('應該處理 JSON 格式的文字', () => {
    const tool = new TestTool();
    const jsonText = JSON.stringify({ status: 'ok', data: [1, 2, 3] });
    const response = tool.createSuccessResponse(jsonText);

    assert.strictEqual(response.content[0].text, jsonText);
  });

  it('應該處理 HTML/XML 內容', () => {
    const tool = new TestTool();
    const htmlContent = '<div>Test <strong>HTML</strong></div>';
    const response = tool.createSuccessResponse(htmlContent);

    assert.strictEqual(response.content[0].text, htmlContent);
  });
});

describe('BaseTool - 類型測試', () => {
  it('name 應該是字串', () => {
    const tool = new TestTool();
    assert.strictEqual(typeof tool.name, 'string');
  });

  it('description 應該是字串', () => {
    const tool = new TestTool();
    assert.strictEqual(typeof tool.description, 'string');
  });

  it('createResponse 應該返回物件', () => {
    const tool = new TestTool();
    const response = tool.createResponse('test');
    assert.strictEqual(typeof response, 'object');
    assert.ok(response !== null);
  });

  it('createSuccessResponse 應該返回物件', () => {
    const tool = new TestTool();
    const response = tool.createSuccessResponse('test');
    assert.strictEqual(typeof response, 'object');
    assert.ok(response !== null);
  });

  it('createErrorResponse 應該返回物件', () => {
    const tool = new TestTool();
    const response = tool.createErrorResponse('test');
    assert.strictEqual(typeof response, 'object');
    assert.ok(response !== null);
  });
});

describe('BaseTool - 整合測試', () => {
  it('應該能夠串連使用多個方法', async () => {
    const tool = new TestTool();

    // 取得定義
    const definition = tool.getDefinition();
    assert.ok(definition);

    // 驗證參數
    const isValid = tool.validateArgs({ cluster: 'test' }, {});
    assert.strictEqual(isValid, true);

    // 執行工具
    const result = await tool.execute({ cluster: 'test' });
    assert.ok(result.content);
  });

  it('應該處理完整的工具執行流程', async () => {
    const tool = new TestTool();

    // 1. 取得工具定義
    const definition = tool.getDefinition();
    assert.strictEqual(definition.name, 'test-tool');

    // 2. 驗證輸入參數
    const args = { cluster: 'my-cluster', namespace: 'default' };
    const isValid = tool.validateArgs(args, definition.inputSchema);
    assert.strictEqual(isValid, true);

    // 3. 執行工具
    const result = await tool.execute(args);
    assert.ok(result);
    assert.ok(result.content);
    assert.strictEqual(result.content[0].type, 'text');
  });
});
