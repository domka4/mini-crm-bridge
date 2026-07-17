import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

const MAX_LOGS = 200;
let logs = [];
let mainWindowRef = null;

function broadcastLog(logObj) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('new-log', logObj);
  }
}

export function setMainWindowForLogs(window) {
  mainWindowRef = window;
}

export function getLogs() {
  return logs;
}

function writeToFile(level, message, meta) {
  try {
    const logPath = path.join(app.getPath('userData'), 'bridge.log');
    const line = `[${new Date().toISOString()}] [${level}] ${message} ${meta ? JSON.stringify(meta) : ''}\n`;
    fs.appendFileSync(logPath, line);
  } catch(e) {}
}

function addLog(level, message, meta = null) {
  const logObj = {
    id: Date.now() + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    level,
    message,
    meta
  };

  logs.push(logObj);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  writeToFile(level, message, meta);
  broadcastLog(logObj);
}

export const logger = {
  info: (message, meta) => {
    console.log(message, meta || '');
    addLog('info', message, meta);
  },
  warn: (message, meta) => {
    console.warn(message, meta || '');
    addLog('warn', message, meta);
  },
  error: (message, meta) => {
    console.error(message, meta || '');
    addLog('error', message, meta);
  }
};
