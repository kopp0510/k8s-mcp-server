class SimpleLogger {
  constructor() {
    this.level = process.env.LOG_LEVEL || 'info';
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  shouldLog(level) {
    return this.levels[level] >= this.levels[this.level];
  }

  format(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logObj = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...this.serializeMeta(meta)
    };

    return JSON.stringify(logObj);
  }

  serializeMeta(meta) {
    if (meta instanceof Error) {
      return {
        error: meta.message,
        stack: meta.stack,
        name: meta.name
      };
    }

    const serialized = {};
    for (const [key, value] of Object.entries(meta)) {
      if (value instanceof Error) {
        serialized[key] = {
          message: value.message,
          stack: value.stack,
          name: value.name
        };
      } else {
        serialized[key] = value;
      }
    }

    return serialized;
  }

  debug(message, meta) {
    if (this.shouldLog('debug')) {
      console.log(this.format('debug', message, meta));
    }
  }

  info(message, meta) {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message, meta));
    }
  }

  warn(message, meta) {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message, meta));
    }
  }

  error(message, meta) {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message, meta));
    }
  }
}

export const logger = new SimpleLogger();