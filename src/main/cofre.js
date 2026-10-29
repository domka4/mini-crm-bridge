import fs from 'node:fs';
import path from 'node:path';
import { app, safeStorage } from 'electron';

// Dados locais do Bridge cifrados pelo Windows (DPAPI, via safeStorage do Electron).
// Nada de senha ou token em texto puro no disco (achado P0-10 do Bridge 1.x).

function pasta() {
  const p = path.join(app.getPath('userData'), 'cofre');
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function exigirCriptografia() {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('A criptografia do sistema não está disponível neste PC.');
}

export function salvar(nome, valor) {
  exigirCriptografia();
  fs.writeFileSync(path.join(pasta(), `${nome}.bin`), safeStorage.encryptString(JSON.stringify(valor)));
}

export function ler(nome) {
  try {
    exigirCriptografia();
    const buf = fs.readFileSync(path.join(pasta(), `${nome}.bin`));
    return JSON.parse(safeStorage.decryptString(buf));
  } catch (_) {
    return null;
  }
}

export function apagar(nome) {
  try { fs.unlinkSync(path.join(pasta(), `${nome}.bin`)); } catch (_) {}
}
