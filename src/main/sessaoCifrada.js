import fs from 'node:fs';
import path from 'node:path';
import { safeStorage } from 'electron';

// Estado de autenticação do WhatsApp (o mesmo formato do useMultiFileAuthState do Baileys),
// com cada arquivo cifrado pelo safeStorage. Quem copiar a pasta para outro PC não abre a sessão.

/** @param {string} pastaSessao  @param {object} B módulo do Baileys */
export async function usarSessaoCifrada(pastaSessao, B) {
  const { initAuthCreds, BufferJSON, proto } = B;
  fs.mkdirSync(pastaSessao, { recursive: true });
  const arquivo = (nome) => path.join(pastaSessao, `${nome.replace(/\//g, '__').replace(/:/g, '-')}.bin`);

  const ler = (nome) => {
    try {
      const texto = safeStorage.decryptString(fs.readFileSync(arquivo(nome)));
      return JSON.parse(texto, BufferJSON.reviver);
    } catch (_) {
      return null;
    }
  };
  const gravar = (nome, dado) => fs.writeFileSync(arquivo(nome), safeStorage.encryptString(JSON.stringify(dado, BufferJSON.replacer)));
  const remover = (nome) => { try { fs.unlinkSync(arquivo(nome)); } catch (_) {} };

  const creds = ler('creds') || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (tipo, ids) => {
          const saida = {};
          for (const id of ids) {
            let valor = ler(`${tipo}-${id}`);
            if (tipo === 'app-state-sync-key' && valor) valor = proto.Message.AppStateSyncKeyData.fromObject(valor);
            saida[id] = valor;
          }
          return saida;
        },
        set: async (dados) => {
          for (const categoria of Object.keys(dados)) {
            for (const id of Object.keys(dados[categoria])) {
              const valor = dados[categoria][id];
              if (valor) gravar(`${categoria}-${id}`, valor);
              else remover(`${categoria}-${id}`);
            }
          }
        },
      },
    },
    salvarCreds: () => gravar('creds', creds),
    apagarTudo: () => fs.rmSync(pastaSessao, { recursive: true, force: true }),
  };
}
