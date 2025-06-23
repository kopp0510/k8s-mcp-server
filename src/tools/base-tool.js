import { validator } from '../utils/validator.js';
import { logger } from '../utils/logger.js';

export class BaseTool {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  // 子類別必須實作
  getDefinition() {
    throw new Error('子類別必須實作 getDefinition 方法');
  }

  async execute(args) {
    throw new Error('子類別必須實作 execute 方法');
  }

  // 通用驗證
  validateInput(args) {
    const definition = this.getDefinition();
    validator.validateInput(args, definition.inputSchema);
  }

  // 統一回應格式
  createResponse(text) {
    return {
      content: [
        {
          type: 'text',
          text: text,
        },
      ],
    };
  }

  createJsonResponse(data) {
    return this.createResponse(JSON.stringify(data, null, 2));
  }

  createErrorResponse(message) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `錯誤: ${message}`,
        },
      ],
    };
  }

  // 日誌
  logSuccess(args, result) {
    logger.info(`工具 ${this.name} 執行成功`, {
      args,
      resultLength: result?.content?.[0]?.text?.length || 0
    });
  }

  logError(args, error) {
    logger.error(`工具 ${this.name} 執行失敗`, {
      args,
      error: error.message
    });
  }
}