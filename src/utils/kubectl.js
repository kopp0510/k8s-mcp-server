import { spawn } from 'child_process';
import { logger } from './logger.js';

export class KubectlRunner {
  constructor() {
    this.timeout = 30000; // 30 second timeout
  }

  async execute(args) {
    // Validate parameters
    if (!Array.isArray(args) || args.length === 0) {
      throw new Error('kubectl arguments must be a non-empty array');
    }

    // Build command
    const command = `kubectl ${args.join(' ')}`;

    logger.debug(`Executing kubectl: ${command}`);

    return new Promise((resolve, reject) => {
      const kubectl = spawn('kubectl', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      kubectl.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      kubectl.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      kubectl.on('close', (code) => {
        if (stderr && !stdout) {
          logger.warn(`kubectl warning: ${stderr}`);
        }

        if (code === 0) {
          resolve(stdout.trim());
        } else {
          logger.error(`kubectl execution failed: ${command}`, { code, stderr });

          // Handle common errors
          if (stderr.includes('timeout')) {
            reject(new Error('kubectl command execution timeout'));
          } else if (stderr.includes('not found')) {
            reject(new Error(`Resource not found: ${stderr.trim()}`));
          } else if (stderr.includes('connection refused')) {
            reject(new Error(`Unable to connect to cluster: ${stderr.trim()}`));
          } else {
            reject(new Error(`kubectl execution failed: ${stderr.trim() || `Exit code: ${code}`}`));
          }
        }
      });

      kubectl.on('error', (error) => {
        logger.error(`kubectl execution failed: ${command}`, error);
        reject(new Error(`kubectl execution failed: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        kubectl.kill('SIGTERM');
        reject(new Error('kubectl command timeout'));
      }, this.timeout);
    });
  }
}

export const kubectl = new KubectlRunner();