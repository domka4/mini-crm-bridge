import { spawn } from 'node:child_process';
import { logger } from './logger.js';

export function createPinggyTunnel(localPort) {
  return new Promise((resolve, reject) => {
    logger.info(`Iniciando Pinggy Tunnel na porta ${localPort}...`);
    // Pinggy provides a generic TCP tunnel
    // ssh -p 443 -R0:localhost:8000 a@tcp.pinggy.io
    const ssh = spawn('ssh', [
      '-p', '443',
      '-R0:localhost:' + localPort,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=30',
      'a@tcp.pinggy.io'
    ]);

    let resolved = false;
    let url = '';

    ssh.stdout.on('data', (data) => {
      const output = data.toString();
      logger.info(`Pinggy stdout: ${output}`);
      // Look for the URL, Pinggy typically prints it like: tcp.pinggy.io:xxxxx
      const match = output.match(/tcp\.pinggy\.io:\d+/);
      if (match && !resolved) {
        resolved = true;
        url = match[0];
        logger.info(`Tunnel conectado: ${url}`);
        resolve({
          url,
          close: () => ssh.kill()
        });
      }
    });

    ssh.stderr.on('data', (data) => {
      const output = data.toString();
      logger.warn(`Pinggy stderr: ${output}`);
      const match = output.match(/tcp\.pinggy\.io:\d+/);
      if (match && !resolved) {
        resolved = true;
        url = match[0];
        logger.info(`Tunnel conectado: ${url}`);
        resolve({
          url,
          close: () => ssh.kill()
        });
      }
    });

    ssh.on('close', (code) => {
      logger.info(`Pinggy process close with code ${code}`);
      if (!resolved) {
        reject(new Error(`SSH tunnel failed to start with code ${code}`));
      }
    });
    
    // Safety timeout
    setTimeout(() => {
      if (!resolved) {
        logger.error('Pinggy tunnel timeout after 15s');
        ssh.kill();
        reject(new Error('Timeout waiting for tunnel URL from Pinggy'));
      }
    }, 15000);
  });
}
