import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import QRCode from 'qrcode';
import pino from 'pino';
import { logger } from '../logger.js';
import { usarSessaoCifrada } from './sessaoCifrada.js';
import { canal, emitirEvento } from './canal.js';

// Motor do WhatsApp do Mini CRM (docs/08 §3.1): uma sessão do Baileys por número, rodando neste PC,
// na mesma rede do celular. Sem proxy, sem túnel, sem servidor Evolution.

let B = null;
async function baileys() {
  if (!B) {
    const m = await import('baileys');
    B = { ...(m.default && typeof m.default === 'object' ? m.default : {}), ...m };
  }
  return B;
}

// Versão do WhatsApp Web anunciada ao conectar: consultada na hora (docs/08 §6.1), com cache de 6 h.
let versaoCache = null;
async function versaoWhatsappWeb() {
  if (versaoCache && Date.now() - versaoCache.em < 6 * 3600 * 1000) return versaoCache.version;
  try {
    const r = B.fetchLatestWaWebVersion ? await B.fetchLatestWaWebVersion() : await B.fetchLatestBaileysVersion();
    versaoCache = { version: r.version, em: Date.now() };
    logger.info(`Versão do WhatsApp Web: ${r.version.join('.')}`);
    return r.version;
  } catch (e) {
    logger.warn(`Não consegui consultar a versão do WhatsApp Web (${e.message}); uso a do Baileys.`);
    return (await B.fetchLatestBaileysVersion()).version;
  }
}

const sessoes = new Map(); // instancia_id -> { rotulo, estado, numero, qr, sock, sessao, tentativas, parada }
export const enviadosPeloBridge = new Set(); // wa_id de mensagens enviadas por aqui (para não voltarem como "do celular")
let aoMudar = () => {};

export function quandoMudar(fn) { aoMudar = fn; }
function avisarUI() { aoMudar(listarNumeros()); }

export function listarNumeros() {
  return [...sessoes.entries()].map(([id, s]) => ({ id, rotulo: s.rotulo, estado: s.estado, numero: s.numero || null, qr: s.qr || null }));
}

export function estadosParaHeartbeat() {
  return [...sessoes.entries()].map(([id, s]) => ({ id, estado: s.estado, ...(s.numero ? { numero: s.numero } : {}) }));
}

function pastaSessao(instanciaId) {
  return path.join(app.getPath('userData'), 'sessoes', instanciaId);
}

/** Este PC já autenticou esse número antes (reconecta sem QR)? */
export function temSessaoSalva(instanciaId) {
  return fs.existsSync(path.join(pastaSessao(instanciaId), 'creds.bin'));
}

/** Mostra na tela um número da conta ligado a este PC, sem conectar (o usuário clica em "Conectar"). */
export function conhecer(instancia) {
  if (sessoes.has(instancia.id)) return;
  sessoes.set(instancia.id, { rotulo: instancia.rotulo || instancia.instance_name, estado: 'desconectado', tentativas: 0, parada: true });
  avisarUI();
}

function emitirConexao(instanciaId, estado, numero) {
  emitirEvento({ tipo: 'status_conexao', instancia_id: instanciaId, dados: { estado, ...(numero ? { numero } : {}) } });
}

/** Liga (ou religa) a sessão de um número. Sessão salva reconecta sem QR. */
export async function iniciar(instancia) {
  const atual = sessoes.get(instancia.id);
  if (atual?.sock || atual?.iniciando) return;
  await baileys();
  const s = atual || { rotulo: instancia.rotulo || instancia.instance_name, estado: 'conectando', tentativas: 0 };
  s.iniciando = true;
  s.parada = false;
  if (s.estado !== 'conectado') s.estado = 'conectando';
  sessoes.set(instancia.id, s);
  avisarUI();

  try {
    s.sessao = await usarSessaoCifrada(pastaSessao(instancia.id), B);
    const silencioso = pino({ level: 'silent' });
    const sock = B.makeWASocket({
      version: await versaoWhatsappWeb(),
      auth: {
        creds: s.sessao.state.creds,
        keys: B.makeCacheableSignalKeyStore ? B.makeCacheableSignalKeyStore(s.sessao.state.keys, silencioso) : s.sessao.state.keys,
      },
      logger: silencioso,
      browser: B.Browsers.windows('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });
    s.sock = sock;
    sock.ev.on('creds.update', s.sessao.salvarCreds);
    sock.ev.on('connection.update', (u) => tratarConexao(instancia, s, sock, u).catch((e) => logger.error(`conexão ${s.rotulo}: ${e.message}`)));
    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages) tratarMensagem(instancia.id, s, m).catch((e) => logger.warn(`mensagem não processada: ${e.message}`));
    });
    sock.ev.on('messages.update', (lista) => {
      for (const { key, update } of lista) {
        const estado = { 0: 'falhou', 2: 'enviada', 3: 'entregue', 4: 'lida', 5: 'lida' }[update?.status];
        if (estado && key?.id && key.fromMe) emitirEvento({ tipo: 'entrega', instancia_id: instancia.id, dados: { wa_id: key.id, estado } });
      }
    });
  } finally {
    s.iniciando = false;
  }
}

async function tratarConexao(instancia, s, sock, u) {
  if (s.sock !== sock) return; // evento de uma conexão antiga (reinício)
  if (u.qr) {
    s.qr = await QRCode.toDataURL(u.qr, { margin: 1, width: 260 });
    if (s.estado !== 'aguardando_qr') {
      s.estado = 'aguardando_qr';
      emitirConexao(instancia.id, 'aguardando_qr');
      logger.info(`${s.rotulo}: escaneie o QR no WhatsApp do celular (Aparelhos conectados).`);
    }
    avisarUI();
  }
  if (u.connection === 'open') {
    s.qr = null;
    s.estado = 'conectado';
    s.tentativas = 0;
    s.numero = String(B.jidNormalizedUser(s.sock.user.id)).split('@')[0].replace(/\D/g, '');
    emitirConexao(instancia.id, 'conectado', s.numero);
    logger.info(`${s.rotulo}: conectado (${s.numero}).`);
    avisarUI();
  }
  if (u.connection === 'close') {
    const codigo = u.lastDisconnect?.error?.output?.statusCode;
    const R = B.DisconnectReason;
    s.sock = null;
    if (s.parada) return;

    // casos em que insistir não adianta (ou piora): para e espera o usuário clicar em "Conectar"
    const pareado = !!s.sessao?.state?.creds?.me;
    let motivo = null;
    if (codigo === R.loggedOut) motivo = 'desconectado pelo celular. Clique em Conectar para ler um QR novo.';
    else if (codigo === R.forbidden) motivo = 'o WhatsApp recusou este número. Confira o celular antes de conectar de novo.';
    else if (!pareado && codigo !== R.restartRequired) motivo = 'o QR expirou. Clique em Conectar para gerar outro.';
    if (motivo) {
      s.parada = true;
      s.estado = 'desconectado';
      s.numero = null;
      s.qr = null;
      s.sessao?.apagarTudo();
      emitirConexao(instancia.id, 'desconectado');
      logger.warn(`${s.rotulo}: ${motivo}`);
      avisarUI();
      return;
    }
    if (codigo === R.connectionReplaced) {
      // a mesma sessão abriu em outro lugar; religar aqui viraria uma disputa entre os dois
      s.parada = true;
      s.estado = 'desconectado';
      s.qr = null;
      emitirConexao(instancia.id, 'desconectado');
      logger.warn(`${s.rotulo}: a sessão foi aberta em outro lugar. Conexão pausada neste PC.`);
      avisarUI();
      return;
    }

    s.estado = 'conectando';
    emitirConexao(instancia.id, 'conectando');
    avisarUI();
    // 515 = o WhatsApp pede para reabrir logo depois de ler o QR
    const espera = codigo === R.restartRequired ? 0 : Math.min(60000, 2000 * 2 ** Math.min(s.tentativas++, 5));
    if (espera) logger.warn(`${s.rotulo}: conexão caiu (código ${codigo ?? '?'}); nova tentativa em ${Math.round(espera / 1000)} s.`);
    setTimeout(() => {
      if (s.parada || sessoes.get(instancia.id) !== s) return; // desconectado ou esquecido enquanto esperava
      iniciar(instancia).catch((e) => logger.error(`religar ${s.rotulo}: ${e.message}`));
    }, espera);
  }
}

function conteudoDe(mensagem) {
  const m = mensagem?.ephemeralMessage?.message || mensagem?.viewOnceMessage?.message || mensagem?.viewOnceMessageV2?.message || mensagem;
  if (!m) return null;
  if (m.protocolMessage || m.reactionMessage || (m.senderKeyDistributionMessage && Object.keys(m).length === 1)) return null;
  if (m.conversation) return { tipo: 'texto', texto: m.conversation };
  if (m.extendedTextMessage?.text) return { tipo: 'texto', texto: m.extendedTextMessage.text };
  if (m.imageMessage) return { tipo: 'imagem', texto: m.imageMessage.caption, mime: m.imageMessage.mimetype, nome: 'imagem.jpg' };
  if (m.videoMessage) return { tipo: 'video', texto: m.videoMessage.caption, mime: m.videoMessage.mimetype, nome: 'video.mp4' };
  if (m.audioMessage) return { tipo: 'audio', mime: m.audioMessage.mimetype, nome: 'audio.ogg' };
  if (m.documentMessage) return { tipo: 'documento', texto: m.documentMessage.caption, mime: m.documentMessage.mimetype, nome: m.documentMessage.fileName || 'documento' };
  if (m.stickerMessage) return { tipo: 'figurinha', mime: m.stickerMessage.mimetype, nome: 'figurinha.webp' };
  return { tipo: 'outro' };
}

/** JID de telefone do contato; mensagens com identificador @lid são resolvidas para o número. */
async function jidDoContato(s, key) {
  let jid = key.remoteJid;
  if (jid && jid.endsWith('@lid')) {
    jid = key.remoteJidAlt || key.senderPn || null;
    if (!jid) {
      try { jid = await s.sock?.signalRepository?.lidMapping?.getPNForLID?.(key.remoteJid); } catch (_) { jid = null; }
    }
  }
  return jid ? B.jidNormalizedUser(jid) : null;
}

async function tratarMensagem(instanciaId, s, m) {
  const key = m.key || {};
  if (!m.message || key.remoteJid === 'status@broadcast' || B.isJidGroup(key.remoteJid)) return;
  if (key.fromMe && enviadosPeloBridge.has(key.id)) return;
  const c = conteudoDe(m.message);
  if (!c) return;
  const jid = await jidDoContato(s, key);
  if (!jid || !jid.endsWith('@s.whatsapp.net')) return;

  let midia_url;
  if (c.mime && !key.fromMe) {
    try {
      const buf = await B.downloadMediaMessage(m, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: s.sock?.updateMediaMessage });
      if (buf.length <= 16 * 1024 * 1024) {
        const u = await canal.urlMidia({ instancia_id: instanciaId, nome: c.nome, tipo: c.mime, tamanho: buf.length });
        const up = await fetch(u.url_upload, { method: 'PUT', headers: { 'Content-Type': c.mime }, body: buf });
        if (up.ok) midia_url = u.url_publica;
      }
    } catch (e) {
      logger.warn(`Mídia recebida não foi salva: ${e.message}`);
    }
  }

  emitirEvento({
    tipo: key.fromMe ? 'mensagem_enviada_pelo_celular' : 'mensagem_recebida',
    instancia_id: instanciaId,
    dados: {
      wa_id: key.id,
      de: jid,
      ...(m.pushName && !key.fromMe ? { nome: String(m.pushName).slice(0, 120) } : {}),
      ...(c.texto ? { texto: c.texto } : {}),
      midia_tipo: c.tipo,
      ...(midia_url ? { midia_url } : {}),
      enviada_em: new Date(Number(m.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
    },
  });
}

/** Socket conectado do número, ou erro claro. */
export function socketConectado(instanciaId) {
  const s = sessoes.get(instanciaId);
  if (!s?.sock || s.estado !== 'conectado') throw new Error('número não está conectado neste PC');
  return s.sock;
}

/** Desconecta o número do WhatsApp (sai dos aparelhos conectados) e apaga a sessão local.
 *  O número continua na lista como "desconectado", pronto para um QR novo. */
export async function desconectar(instanciaId) {
  const s = sessoes.get(instanciaId);
  if (!s) return;
  s.parada = true;
  const sock = s.sock;
  s.sock = null;
  try { await sock?.logout(); } catch (_) {}
  try { sock?.end(undefined); } catch (_) {}
  s.sessao?.apagarTudo();
  s.sessao = null;
  s.estado = 'desconectado';
  s.numero = null;
  s.qr = null;
  emitirConexao(instanciaId, 'desconectado');
  avisarUI();
}

/** Derruba e religa a conexão (sem apagar a sessão). */
export async function reiniciar(instancia) {
  const s = sessoes.get(instancia.id);
  if (s) { s.parada = true; try { s.sock?.end(undefined); } catch (_) {} s.sock = null; }
  await iniciar(instancia);
}

/** Para todas as sessões sem deslogar (fechar o app). */
export function pararTodas() {
  for (const s of sessoes.values()) { s.parada = true; try { s.sock?.end(undefined); } catch (_) {} }
}

/** Esquece um número que não é mais deste PC (sem deslogar no celular). */
export function esquecer(instanciaId) {
  const s = sessoes.get(instanciaId);
  if (!s) return;
  s.parada = true;
  try { s.sock?.end(undefined); } catch (_) {}
  sessoes.delete(instanciaId);
  avisarUI();
}

export { baileys };
