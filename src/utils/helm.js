import { spawn } from 'child_process';
import { logger } from './logger.js';

export class HelmRunner {
  constructor() {
    this.timeout = 60000; // 60 second timeout (Helm operations usually slower than kubectl)
  }

  async execute(args) {
    // Validate parameters
    if (!Array.isArray(args) || args.length === 0) {
      throw new Error('helm arguments must be a non-empty array');
    }

    // Build command
    const command = `helm ${args.join(' ')}`;

    logger.debug(`Executing helm: ${command}`);

    return new Promise((resolve, reject) => {
      const helm = spawn('helm', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      helm.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      helm.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      helm.on('close', (code) => {
        if (stderr && !stdout) {
          logger.warn(`helm warning: ${stderr}`);
        }

        if (code === 0) {
          resolve(stdout.trim());
        } else {
          logger.error(`helm execution failed: ${command}`, { code, stderr });

          // Handle common errors
          if (stderr.includes('timeout')) {
            reject(new Error('helm command execution timeout'));
          } else if (stderr.includes('not found')) {
            reject(new Error(`Resource not found: ${stderr.trim()}`));
          } else if (stderr.includes('connection refused')) {
            reject(new Error(`Unable to connect to cluster: ${stderr.trim()}`));
          } else {
            reject(new Error(`helm execution failed: ${stderr.trim() || `Exit code: ${code}`}`));
          }
        }
      });

      helm.on('error', (error) => {
        logger.error(`helm execution failed: ${command}`, error);
        reject(new Error(`helm execution failed: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        helm.kill('SIGTERM');
        reject(new Error('helm command timeout'));
      }, this.timeout);
    });
  }
}

export const helm = new HelmRunner();