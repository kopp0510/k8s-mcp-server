import { validator } from '../utils/validator.js';
import { logger } from '../utils/logger.js';
import { clusterManager } from '../utils/cluster-manager.js';

/**
 * Prerequisite check failure error class
 * This type of error should stop the entire workflow execution
 */
export class PrerequisiteError extends Error {
  constructor(message, cluster, tool) {
    super(message);
    this.name = 'PrerequisiteError';
    this.cluster = cluster;
    this.tool = tool;
    this.shouldStopWorkflow = true; // Mark this error as needing to stop the workflow
  }
}

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

  /**
   * Execute prerequisite checks
   * @param {Object} args - Tool parameters
   * @throws {PrerequisiteError} Throws special error if prerequisite check fails
   */
  async validatePrerequisites(args) {
    // Check cluster prerequisites
    if (args.cluster) {
      try {
        await clusterManager.validateClusterPrerequisites(args.cluster);
      } catch (error) {
        logger.error(`Prerequisite check failed - Tool: ${this.name}, Cluster: ${args.cluster}`, {
          tool: this.name,
          cluster: args.cluster,
          error: error.message
        });

        // Throw special PrerequisiteError
        throw new PrerequisiteError(error.message, args.cluster, this.name);
      }
    }
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

  /**
   * Create error response
   * @param {string} message - Error message
   * @param {boolean} isError - Is error
   * @returns {Object} MCP error response format
   */
  createErrorResponse(message, isError = true) {
    return {
      content: [{
        type: "text",
        text: `Error: ${message}`
      }],
      isError
    };
  }

  // Logging
  logSuccess(result) {
    logger.info(`Tool ${this.name} executed successfully`, {
      tool: this.name,
      resultLength: result?.content?.[0]?.text?.length || 0
    });
  }

  /**
   * Log error (retain original functionality)
   * @param {Object} args - Tool parameters
   * @param {Error} error - Error object
   */
  logError(args, error) {
    logger.error(`Tool ${this.name} execution failed`, {
      tool: this.name,
      args,
      message: error.message,
      stack: error.stack,
      name: error.name,
      action: 'OPERATION_ABORTED'
    });
  }

  /**
   * Create success response
   * @param {string} text - Response text
   * @param {string} type - Content type
   * @returns {Object} MCP success response format
   */
  createSuccessResponse(text, type = "text") {
    return {
      content: [{
        type: type,
        text: text
      }]
    };
  }
}