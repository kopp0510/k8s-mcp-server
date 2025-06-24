#!/usr/bin/env node

/**
 * K8s MCP Server Main Entry Point
 * Handles lifecycle and parameter parsing
 */

import { logger } from './utils/logger.js';
import { createMCPServer } from './server.js';

/**
 * Parse command line arguments
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
 * Setup environment variables
 */
function setupEnvironment(config) {
  // Set log level
  if (config.logLevel) {
    process.env.LOG_LEVEL = config.logLevel;
  }

  // Set execution environment
  if (config.nodeEnv) {
    process.env.NODE_ENV = config.nodeEnv;
  }

  logger.info('Environment setup completed', {
    nodeEnv: config.nodeEnv,
    logLevel: config.logLevel,
    httpMode: config.httpMode,
    port: config.port
  });
}

/**
 * Handle graceful shutdown
 */
function setupGracefulShutdown(server) {
  const shutdown = async (signal) => {
    logger.info(`Received ${signal} signal, preparing to shutdown server...`);

    try {
      if (server && typeof server.close === 'function') {
        await server.close();
      }
      logger.info('Server shutdown completed gracefully');
      process.exit(0);
    } catch (error) {
      logger.error('Error occurred while shutting down server:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart signal
}

/**
 * Handle uncaught exceptions
 */
function setupErrorHandlers() {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise rejection:', { reason, promise });
    process.exit(1);
  });
}

/**
 * Main function
 */
async function main() {
  try {
    // Parse arguments
    const config = parseArguments();

    // Setup environment
    setupEnvironment(config);

    // Setup error handlers
    setupErrorHandlers();

    // Create and start server
    logger.info('Starting K8s MCP Server...');
    const server = await createMCPServer(config);

    // Setup graceful shutdown
    setupGracefulShutdown(server);

    logger.info('K8s MCP Server startup completed');

  } catch (error) {
    logger.error('Startup failed:', error);
    process.exit(1);
  }
}

// If executing this file directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Application error:', error);
    process.exit(1);
  });
}

export { main };