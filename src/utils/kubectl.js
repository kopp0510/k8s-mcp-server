import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';

const execAsync = promisify(exec);

class SimpleKubectl {
  constructor() {
    this.timeout = 30000; // 30 秒超時
  }

  async execute(args) {
    // 驗證參數
    if (!Array.isArray(args) || args.length === 0) {
      throw new Error('kubectl 參數必須是非空陣列');
    }

    // 建構指令
    const command = ['kubectl', ...args].join(' ');

    logger.debug(`執行 kubectl: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      if (stderr) {
        logger.warn(`kubectl 警告: ${stderr}`);
      }

      return stdout;

    } catch (error) {
      logger.error(`kubectl 執行失敗: ${command}`, error);

      // 處理常見錯誤
      if (error.code === 'ETIMEDOUT') {
        throw new Error('kubectl 指令執行超時');
      }

      if (error.stderr) {
        throw new Error(error.stderr);
      }

      throw new Error(`kubectl 執行失敗: ${error.message}`);
    }
  }
}

export const kubectl = new SimpleKubectl();