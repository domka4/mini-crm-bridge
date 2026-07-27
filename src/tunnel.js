import { Client } from 'ssh2';
import { logger } from './logger.js';
import { Socket } from 'net';

export function createPinggyTunnel(localPort) {
  return new Promise((resolve, reject) => {
    logger.info(`Iniciando Pinggy Tunnel via ssh2 na porta ${localPort}...`);
    
    const conn = new Client();
    let resolved = false;
    let url = '';

    // Regex para pegar tcp://xxxx.pinggy.link:12345
    const urlRegex = /tcp:\/\/[a-zA-Z0-9.-]+\.(pinggy-free\.link|pinggy\.(io|link)):\d+/;

    conn.on('ready', () => {
      logger.info('SSH connection ready, requesting port forward...');
      conn.forwardIn('127.0.0.1', 0, (err) => {
        if (err) {
          logger.error('Error forwarding remote port: ' + err.message);
        }
      });
      
      conn.shell({ term: 'xterm' }, (err, stream) => {
        if (err) {
          if (!resolved) reject(err);
          return;
        }

        stream.on('data', (data) => {
          const output = data.toString();
          const match = output.match(urlRegex);
          if (match && !resolved) {
            resolved = true;
            url = match[0].replace('tcp://', ''); // limpa prefixo para pegar só host:port
            logger.info(`Tunnel conectado via ssh2: ${url}`);
            resolve({
              url,
              close: () => conn.end()
            });
          }
        });
      });
    }).on('tcp connection', (info, accept, reject) => {
      const stream = accept();
      const localSocket = new Socket();
      localSocket.connect(localPort, '127.0.0.1', () => {
        stream.pipe(localSocket).pipe(stream);
      });
      localSocket.on('error', (err) => {
        logger.error('Local socket errored: ' + err.message);
        stream.end();
      });
    }).on('error', (err) => {
      logger.error('SSH Error: ' + err.message);
      if (!resolved) {
        reject(err);
      }
    }).on('close', () => {
      logger.info('SSH connection closed');
      if (!resolved) {
        reject(new Error('SSH connection closed unexpectedly'));
      }
    }).connect({
      host: 'a.pinggy.io',
      port: 443,
      username: 'tcp',
      password: 'a',
      tryKeyboard: true,
      readyTimeout: 15000
    });
    
    // Timeout global
    setTimeout(() => {
      if (!resolved) {
        logger.error('Pinggy tunnel timeout after 15s');
        conn.end();
        reject(new Error('Timeout ao conectar ao Pinggy tunnel'));
      }
    }, 15000);
  });
}
