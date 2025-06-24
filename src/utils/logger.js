/**
 * Simple Logger Utility
 * Provides structured logging functionality with multiple log levels
 */

/**
 * Simple logger class that provides structured logging with level filtering
 * Outputs logs in JSON format with timestamp and metadata support
 *
 * Supported log levels (from lowest to highest priority):
 * - debug: Detailed information for debugging
 * - info: General information messages
 * - warn: Warning messages
 * - error: Error messages
 */
class SimpleLogger {
  /**
   * Initialize logger with configuration
   * Sets log level from environment variable LOG_LEVEL or defaults to 'info'
   */
  constructor() {
    // Set log level from environment or default to 'info'
    this.level = process.env.LOG_LEVEL || 'info';

    // Define log level priorities (higher number = higher priority)
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  /**
   * Check if a message should be logged based on current log level
   * @param {string} level - Log level to check ('debug', 'info', 'warn', 'error')
   * @returns {boolean} - True if message should be logged
   */
  shouldLog(level) {
    return this.levels[level] >= this.levels[this.level];
  }

  /**
   * Format log message into structured JSON format
   * @param {string} level - Log level
   * @param {string} message - Main log message
   * @param {Object} meta - Additional metadata to include in log
   * @returns {string} - JSON formatted log string
   */
  format(level, message, meta = {}) {
    // Add ISO timestamp for consistent time formatting
    const timestamp = new Date().toISOString();

    // Build structured log object
    const logObj = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...this.serializeMeta(meta)
    };

    // Return as JSON string for structured logging
    return JSON.stringify(logObj);
  }

  /**
   * Serialize metadata objects, handling Error objects specially
   * Converts Error objects to plain objects with message, stack, and name
   * @param {any} meta - Metadata to serialize
   * @returns {Object} - Serialized metadata object
   */
  serializeMeta(meta) {
    // Handle case where meta is directly an Error object
    if (meta instanceof Error) {
      return {
        error: meta.message,
        stack: meta.stack,
        name: meta.name
      };
    }

    // Process each property in metadata object
    const serialized = {};
    for (const [key, value] of Object.entries(meta)) {
      if (value instanceof Error) {
        // Convert Error objects to plain objects for JSON serialization
        serialized[key] = {
          message: value.message,
          stack: value.stack,
          name: value.name
        };
      } else {
        // Keep other values as-is
        serialized[key] = value;
      }
    }

    return serialized;
  }

  /**
   * Log debug level message
   * Used for detailed debugging information, typically only in development
   * @param {string} message - Debug message
   * @param {Object} meta - Optional metadata
   */
  debug(message, meta) {
    if (this.shouldLog('debug')) {
      console.log(this.format('debug', message, meta));
    }
  }

  /**
   * Log info level message
   * Used for general informational messages about application flow
   * @param {string} message - Info message
   * @param {Object} meta - Optional metadata
   */
  info(message, meta) {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message, meta));
    }
  }

  /**
   * Log warning level message
   * Used for potentially problematic situations that aren't errors
   * @param {string} message - Warning message
   * @param {Object} meta - Optional metadata
   */
  warn(message, meta) {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message, meta));
    }
  }

  /**
   * Log error level message
   * Used for error conditions that need attention
   * @param {string} message - Error message
   * @param {Object} meta - Optional metadata, often includes Error objects
   */
  error(message, meta) {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message, meta));
    }
  }
}

/**
 * Exported logger instance
 * Pre-configured SimpleLogger instance ready for use throughout the application
 *
 * Usage examples:
 * - logger.info('Server started', { port: 3000 })
 * - logger.error('Database connection failed', error)
 * - logger.debug('Processing request', { userId: 123, action: 'getData' })
 * - logger.warn('Deprecated API used', { endpoint: '/old-api' })
 */
export const logger = new SimpleLogger();