import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';

const execAsync = promisify(exec);

class SimpleHelm {
  constructor() {
    this.timeout = 60000; // 60 秒超時（Helm 操作通常比 kubectl 慢）
  }

  async execute(args) {
    // 驗證參數
    if (!Array.isArray(args) || args.length === 0) {
      throw new Error('helm 參數必須是非空陣列');
    }

    // 建構指令
    const command = ['helm', ...args].join(' ');

    logger.debug(`執行 helm: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      if (stderr) {
        logger.warn(`helm 警告: ${stderr}`);
      }

      return stdout;

    } catch (error) {
      logger.error(`helm 執行失敗: ${command}`, error);

      // 處理常見錯誤
      if (error.code === 'ETIMEDOUT') {
        throw new Error('helm 指令執行超時');
      }

      if (error.stderr) {
        throw new Error(error.stderr);
      }

      throw new Error(`helm 執行失敗: ${error.message}`);
    }
  }

  async executeWithTimeout(args, timeoutMs) {
    const originalTimeout = this.timeout;
    this.timeout = timeoutMs;
    try {
      return await this.execute(args);
    } finally {
      this.timeout = originalTimeout;
    }
  }
}

export const helm = new SimpleHelm();