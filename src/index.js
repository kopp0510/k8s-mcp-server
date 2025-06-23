#!/usr/bin/env node

/**
 * K8s MCP Server 主程式入口
 * 處理生命週期和參數解析
 */

import { logger } from './utils/logger.js';
import { createMCPServer } from './server.js';

/**
 * 解析命令列參數
 */
function parseArguments() {
  const args = process.argv.slice(2);

  return {
    httpMode: args.includes('--http'),
    port: args.includes('--port') ?
      parseInt(args[args.indexOf('--port') + 1]) :
      parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'production',
    logLevel: process.env.LOG_LEVEL || 'info'
  };
}

/**
 * 設定環境變數
 */
function setupEnvironment(config) {
  // 設定日誌等級
  if (config.logLevel) {
    process.env.LOG_LEVEL = config.logLevel;
  }

  // 設定執行環境
  if (config.nodeEnv) {
    process.env.NODE_ENV = config.nodeEnv;
  }

  logger.info('環境設定完成', {
    nodeEnv: config.nodeEnv,
    logLevel: config.logLevel,
    httpMode: config.httpMode,
    port: config.port
  });
}

/**
 * 處理程式退出
 */
function setupGracefulShutdown(server) {
  const shutdown = async (signal) => {
    logger.info(`收到 ${signal} 信號，準備關閉伺服器...`);

    try {
      if (server && typeof server.close === 'function') {
        await server.close();
      }
      logger.info('伺服器已正常關閉');
      process.exit(0);
    } catch (error) {
      logger.error('關閉伺服器時發生錯誤:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon 重啟信號
}

/**
 * 處理未捕獲的異常
 */
function setupErrorHandlers() {
  process.on('uncaughtException', (error) => {
    logger.error('未捕獲的異常:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未處理的 Promise 拒絕:', { reason, promise });
    process.exit(1);
  });
}

/**
 * 主函數
 */
async function main() {
  try {
    // 解析參數
    const config = parseArguments();

    // 設定環境
    setupEnvironment(config);

    // 設定錯誤處理
    setupErrorHandlers();

    // 創建並啟動伺服器
    logger.info('正在啟動 K8s MCP Server...');
    const server = await createMCPServer(config);

    // 設定優雅關閉
    setupGracefulShutdown(server);

    logger.info('K8s MCP Server 啟動完成');

  } catch (error) {
    logger.error('啟動失敗:', error);
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

export { main };