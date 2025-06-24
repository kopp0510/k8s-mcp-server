import { validator } from '../utils/validator.js';
import { logger } from '../utils/logger.js';

/**
 * Base tool class
 * Provides common functionality for all MCP tools
 */
export class BaseTool {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  // Subclasses must implement
  getDefinition() {
    throw new Error('Subclasses must implement getDefinition method');
  }

  async execute(args) {
    throw new Error('Subclasses must implement execute method');
  }

  // Common validation
  validateArgs(args, schema) {
    // Can add more detailed validation logic here
    return true;
  }

  // Unified response format
  createResponse(content, isError = false) {
    if (isError) {
      return {
        content: [
          {
            type: "text",
            text: content
          }
        ],
        isError: true
      };
    }

    return {
      content: [
        {
          type: "text",
          text: content
        }
      ]
    };
  }

  createErrorResponse(message) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        }
      ],
      isError: true
    };
  }

  // Logging
  logSuccess(result) {
    logger.info(`Tool ${this.name} executed successfully`, {
      tool: this.name,
      resultLength: result?.content?.[0]?.text?.length || 0
    });
  }

  logError(error, args) {
    logger.error(`Tool ${this.name} execution failed`, {
      tool: this.name,
      error: error.message,
      args
    });
  }
}