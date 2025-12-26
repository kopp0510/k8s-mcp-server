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
 * 輸出模式定義
 * compact: 精簡模式，只含核心數據（約 20% tokens）
 * normal: 標準模式，精簡數據 + 簡短說明（約 50% tokens）
 * verbose: 詳細模式，完整數據（100% tokens）
 */
export const OUTPUT_MODES = {
  COMPACT: 'compact',
  NORMAL: 'normal',
  VERBOSE: 'verbose'
};

/**
 * 從環境變數取得預設輸出模式
 * 環境變數: MCP_OUTPUT_MODE (可設為 compact, normal, verbose)
 * 預設值: normal
 */
export const DEFAULT_OUTPUT_MODE = (() => {
  const envMode = process.env.MCP_OUTPUT_MODE?.toLowerCase();
  if (envMode && Object.values(OUTPUT_MODES).includes(envMode)) {
    return envMode;
  }
  return OUTPUT_MODES.NORMAL;
})();

/**
 * Base tool class
 * Provides common functionality for all MCP tools
 */
export class BaseTool {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  /**
   * 獲取輸出模式（子類別可覆寫預設值）
   * @param {Object} args - 工具參數
   * @returns {string} 輸出模式
   */
  getOutputMode(args) {
    return args.outputMode || DEFAULT_OUTPUT_MODE;
  }

  /**
   * 過濾 K8s 資源的冗餘 metadata
   * 移除 managedFields、resourceVersion 等不必要的欄位
   * @param {Object} resource - K8s 資源物件
   * @param {string} mode - 輸出模式
   * @returns {Object} 過濾後的資源物件
   */
  filterK8sMetadata(resource, mode = OUTPUT_MODES.NORMAL) {
    if (!resource || typeof resource !== 'object') {
      return resource;
    }

    // 深拷貝避免修改原始資料
    const filtered = JSON.parse(JSON.stringify(resource));

    // 要移除的 metadata 欄位
    const fieldsToRemove = {
      compact: [
        'managedFields', 'resourceVersion', 'selfLink', 'uid',
        'generation', 'creationTimestamp', 'ownerReferences',
        'finalizers', 'annotations', 'labels'
      ],
      normal: [
        'managedFields', 'resourceVersion', 'selfLink',
        'generation', 'ownerReferences', 'finalizers'
      ],
      verbose: ['managedFields'] // 只移除最冗長的 managedFields
    };

    const removeFields = fieldsToRemove[mode] || fieldsToRemove.normal;

    // 過濾單一資源
    const filterResource = (obj) => {
      if (obj.metadata) {
        removeFields.forEach(field => {
          delete obj.metadata[field];
        });
      }

      // compact 模式下進一步精簡 status
      if (mode === OUTPUT_MODES.COMPACT && obj.status) {
        // 只保留關鍵狀態
        const essentialStatus = {};
        if (obj.status.phase) essentialStatus.phase = obj.status.phase;
        if (obj.status.replicas !== undefined) essentialStatus.replicas = obj.status.replicas;
        if (obj.status.readyReplicas !== undefined) essentialStatus.readyReplicas = obj.status.readyReplicas;
        if (obj.status.availableReplicas !== undefined) essentialStatus.availableReplicas = obj.status.availableReplicas;
        if (obj.status.conditions) {
          // 只保留最新的 condition
          essentialStatus.conditions = obj.status.conditions.slice(-1);
        }
        obj.status = essentialStatus;
      }

      // compact 模式下移除 spec 的細節
      if (mode === OUTPUT_MODES.COMPACT && obj.spec) {
        const essentialSpec = {};
        if (obj.spec.replicas !== undefined) essentialSpec.replicas = obj.spec.replicas;
        if (obj.spec.selector) essentialSpec.selector = obj.spec.selector;
        if (obj.spec.containers) {
          essentialSpec.containers = obj.spec.containers.map(c => ({
            name: c.name,
            image: c.image
          }));
        }
        if (obj.spec.template?.spec?.containers) {
          essentialSpec.containers = obj.spec.template.spec.containers.map(c => ({
            name: c.name,
            image: c.image
          }));
        }
        obj.spec = essentialSpec;
      }

      return obj;
    };

    // 處理列表或單一資源
    if (filtered.items && Array.isArray(filtered.items)) {
      filtered.items = filtered.items.map(filterResource);
    } else {
      filterResource(filtered);
    }

    return filtered;
  }

  /**
   * 創建 K8s 資源的精簡摘要
   * @param {Object} resource - K8s 資源物件
   * @returns {Object} 摘要物件
   */
  createResourceSummary(resource) {
    if (!resource) return null;

    // 處理列表
    if (resource.items && Array.isArray(resource.items)) {
      return {
        kind: resource.kind,
        count: resource.items.length,
        items: resource.items.map(item => this.createSingleResourceSummary(item))
      };
    }

    return this.createSingleResourceSummary(resource);
  }

  /**
   * 創建單一資源的摘要
   */
  createSingleResourceSummary(resource) {
    const summary = {
      name: resource.metadata?.name,
      namespace: resource.metadata?.namespace
    };

    // 根據資源類型添加關鍵資訊
    const kind = resource.kind?.toLowerCase();

    switch (kind) {
      case 'pod':
        summary.status = resource.status?.phase;
        summary.containers = resource.spec?.containers?.length || 0;
        summary.restarts = resource.status?.containerStatuses?.reduce(
          (sum, c) => sum + (c.restartCount || 0), 0
        );
        break;

      case 'deployment':
        summary.replicas = `${resource.status?.readyReplicas || 0}/${resource.spec?.replicas || 0}`;
        summary.available = resource.status?.availableReplicas || 0;
        break;

      case 'service':
        summary.type = resource.spec?.type;
        summary.clusterIP = resource.spec?.clusterIP;
        summary.ports = resource.spec?.ports?.map(p => `${p.port}/${p.protocol}`);
        break;

      case 'node':
        summary.status = resource.status?.conditions?.find(c => c.type === 'Ready')?.status;
        summary.roles = Object.keys(resource.metadata?.labels || {})
          .filter(l => l.startsWith('node-role.kubernetes.io/'))
          .map(l => l.replace('node-role.kubernetes.io/', ''));
        break;

      case 'configmap':
      case 'secret':
        summary.dataKeys = Object.keys(resource.data || {});
        break;

      default:
        // 其他資源類型的通用摘要
        if (resource.status?.phase) summary.phase = resource.status.phase;
        if (resource.spec?.replicas !== undefined) summary.replicas = resource.spec.replicas;
    }

    return summary;
  }

  /**
   * 根據輸出模式決定是否包含說明文字
   * @param {string} mode - 輸出模式
   * @returns {boolean}
   */
  shouldIncludeHints(mode) {
    return mode === OUTPUT_MODES.VERBOSE;
  }

  /**
   * 根據輸出模式決定是否包含範例
   * @param {string} mode - 輸出模式
   * @returns {boolean}
   */
  shouldIncludeExamples(mode) {
    return mode === OUTPUT_MODES.VERBOSE;
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