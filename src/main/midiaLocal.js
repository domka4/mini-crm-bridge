import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

// Mídias do WhatsApp guardadas neste PC (decisão de 29/10/2026): fotos, áudios, vídeos, documentos e
// figurinhas ficam em <dados do app>/midia/<número>/<id da mensagem>.<ext>. O CRM guarda só a miniatura
// e, quando alguém abre a mídia, pede uma cópia temporária (comando midia.copia).

const EXTENSOES = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/3gpp': '3gp', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac',
  'application/pdf': 'pdf',
};
const MINIATURA_MAX_BYTES = 24 * 1024;

const seguro = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
const mimeBase = (mime) => String(mime || 'application/octet-stream').split(';')[0].trim();

export function pastaMidias() {
  return path.join(app.getPath('userData'), 'midia');
}

function pasta(instanciaId) {
  const p = path.join(pastaMidias(), seguro(instanciaId));
  fs.mkdirSync(p, { recursive: true });
  return p;
}

/** Grava o arquivo da mensagem e devolve o que o CRM precisa saber dele. */
export function guardar(instanciaId, waId, mime, nome, buf) {
  const base = mimeBase(mime);
  const ext = EXTENSOES[base] || seguro(path.extname(nome || '').slice(1)) || 'bin';
  fs.writeFileSync(path.join(pasta(instanciaId), `${seguro(waId)}.${ext}`), buf);
  return { mime: base, nome: String(nome || `arquivo.${ext}`).slice(0, 200), tamanho: buf.length };
}

/** Caminho do arquivo guardado para a mensagem, ou null. */
export function achar(instanciaId, waId) {
  const p = pasta(instanciaId);
  const prefixo = `${seguro(waId)}.`;
  const nome = fs.readdirSync(p).find((n) => n.startsWith(prefixo));
  return nome ? path.join(p, nome) : null;
}

/** Miniatura em data URL (até 24 KB): a que o WhatsApp manda junto ou, na figurinha pequena, ela inteira. */
export function miniatura(c, buf) {
  // vem como bytes (mensagem ao vivo) ou base64 (mensagem guardada pelo WhatsApp)
  const mini = typeof c.miniatura === 'string' ? Buffer.from(c.miniatura, 'base64') : c.miniatura ? Buffer.from(c.miniatura) : null;
  if (mini?.length && mini.length <= MINIATURA_MAX_BYTES) {
    return `data:image/jpeg;base64,${mini.toString('base64')}`;
  }
  if (c.tipo === 'figurinha' && buf?.length && buf.length <= MINIATURA_MAX_BYTES) {
    return `data:image/webp;base64,${buf.toString('base64')}`;
  }
  return undefined;
}
