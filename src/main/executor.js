import { logger } from '../logger.js';
import * as cofre from './cofre.js';
import { canal, emitirEvento } from './canal.js';
import * as motor from './motor.js';

// Execução dos comandos do CRM (docs/08 §4) com o ritmo anti-ban (docs/08 §6):
// - envios: um de cada vez por número, intervalo aleatório entre eles, "digitando…" antes;
// - resposta do chat (ritmo "conversa") passa na frente das campanhas e não espera o intervalo longo;
// - pausa do número depois de falhas seguidas;
// - comando já executado não é refeito: o resultado guardado é reenviado (o CRM pode reentregar).

let config = {
  ritmo: { intervalo_min_s: 45, intervalo_max_s: 180, presenca_ms_por_caractere: 40, presenca_max_ms: 8000 },
  protecao: { falhas_para_pausar: 3, pausa_min: 30 },
};
export function definirConfig(c) { if (c?.ritmo) config = { ...config, ...c }; }

const MAX_EXECUTADOS = 1000;
let executados = null; // { [id]: { ok, resultado, erro } }
function memoria() {
  if (!executados) executados = cofre.ler('executados') || {};
  return executados;
}
function lembrar(id, saida) {
  const m = memoria();
  m[id] = saida;
  const ids = Object.keys(m);
  if (ids.length > MAX_EXECUTADOS) for (const velho of ids.slice(0, ids.length - MAX_EXECUTADOS)) delete m[velho];
  cofre.salvar('executados', m);
}

const emAndamento = new Set();
const filas = new Map(); // instancia_id -> { itens: [], rodando, ultimoEnvio, falhas, pausadoAte }

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const aleatorio = (min, max) => min + Math.random() * (max - min);
const jidDe = (para) => (para.includes('@') ? para : `${para}@s.whatsapp.net`);
const ritmoDe = (cmd) => (cmd.payload?.ritmo === 'conversa' ? 'conversa' : 'campanha');
const INTERVALO_CONVERSA_S = [1.5, 4];

// Celular brasileiro com e sem o nono dígito: o WhatsApp registra muitos números (DDD 31 em diante,
// contas antigas) sem o 9, e o CRM costuma ter o contato salvo com ele.
function variantesNumero(n) {
  const d = String(n).replace(/\D/g, '');
  const v = [d];
  if (d.startsWith('55') && d.length === 13 && d[4] === '9') v.push(d.slice(0, 4) + d.slice(5));
  if (d.startsWith('55') && d.length === 12 && /[6-9]/.test(d[4])) v.push(d.slice(0, 4) + '9' + d.slice(4));
  return v;
}

const jidsConhecidos = new Map(); // número pedido -> { jid, em }
const VALIDADE_JID_MS = 24 * 3600 * 1000;

/**
 * JID real de um telefone no WhatsApp (pergunta ao próprio WhatsApp, com e sem o nono dígito).
 * Sem isso, a mensagem vai para um endereço que não existe e some sem erro. Grupo passa direto.
 * @returns {Promise<string|null>} null quando o número não tem WhatsApp
 */
async function jidReal(sock, para) {
  if (String(para).includes('@')) return para;
  const c = jidsConhecidos.get(para);
  if (c && Date.now() - c.em < VALIDADE_JID_MS) return c.jid;
  for (const n of variantesNumero(para)) {
    const [r] = (await sock.onWhatsApp(n)) || [];
    if (r?.exists && r.jid) {
      jidsConhecidos.set(para, { jid: r.jid, em: Date.now() });
      return r.jid;
    }
  }
  return null;
}

/** Telefone (JID) de um participante de grupo; em grupos com LID o número vem em phoneNumber. */
function jidTelefone(p) {
  if (p?.phoneNumber) return p.phoneNumber;
  return String(p?.id || '').endsWith('@s.whatsapp.net') ? p.id : null;
}

/** Recebe um comando do CRM. Envios entram na fila do número; o resto roda na hora. */
export function receber(cmd) {
  const guardado = memoria()[cmd.id];
  if (guardado) return responder(cmd.id, guardado); // já feito: só reenvia o resultado
  if (emAndamento.has(cmd.id)) return; // reentrega enquanto ainda está na fila local
  emAndamento.add(cmd.id);
  if (cmd.tipo === 'mensagem.enviar') return enfileirarEnvio(cmd);
  executar(cmd).then((saida) => concluir(cmd, saida));
}

/** Quantos envios estão esperando neste PC (o atualizador espera zerar antes de reiniciar). */
export function enviosPendentes() {
  let total = 0;
  for (const f of filas.values()) total += f.itens.length + (f.rodando ? 1 : 0);
  return total;
}

/** Comandos que este PC já pegou e ainda não respondeu: o heartbeat renova o prazo deles no CRM. */
export function comandosEmMaos() {
  return [...emAndamento].slice(0, 200);
}

async function responder(id, saida) {
  try { await canal.resultado(id, saida.ok, saida.resultado, saida.erro); }
  catch (e) { logger.warn(`Resultado do comando ${id} não enviado: ${e.message}`); }
}

async function concluir(cmd, saida) {
  emAndamento.delete(cmd.id);
  lembrar(cmd.id, saida);
  await responder(cmd.id, saida);
}

function enfileirarEnvio(cmd) {
  const f = filas.get(cmd.instancia_id) || { itens: [], rodando: false, ultimoEnvio: 0, falhas: 0, pausadoAte: 0, acordar: null };
  filas.set(cmd.instancia_id, f);
  if (ritmoDe(cmd) === 'conversa') {
    // na frente das campanhas, mantendo a ordem entre as conversas
    const i = f.itens.findIndex((x) => ritmoDe(x) !== 'conversa');
    if (i === -1) f.itens.push(cmd);
    else f.itens.splice(i, 0, cmd);
    f.acordar?.(); // interrompe a espera longa de uma campanha
  } else {
    f.itens.push(cmd);
  }
  if (!f.rodando) processarFila(cmd.instancia_id, f);
}

/** Espera ms; se interrompível, uma conversa que chega acorda a fila antes. Devolve true se foi acordada. */
function esperar(f, ms, interrompivel) {
  return new Promise((fim) => {
    const t = setTimeout(() => { f.acordar = null; fim(false); }, ms);
    if (interrompivel) f.acordar = () => { clearTimeout(t); f.acordar = null; fim(true); };
  });
}

async function processarFila(instanciaId, f) {
  f.rodando = true;
  while (f.itens.length) {
    const agora = Date.now();
    if (f.pausadoAte > agora) { await esperar(f, f.pausadoAte - agora, false); continue; }
    const proximo = f.itens[0];
    const [min, max] = ritmoDe(proximo) === 'conversa'
      ? INTERVALO_CONVERSA_S
      : [config.ritmo.intervalo_min_s, config.ritmo.intervalo_max_s];
    const faltam = f.ultimoEnvio + aleatorio(min, max) * 1000 - Date.now();
    if (f.ultimoEnvio && faltam > 0 && await esperar(f, faltam, ritmoDe(proximo) !== 'conversa')) continue;

    const cmd = f.itens.shift();
    const saida = await executar(cmd);
    f.ultimoEnvio = Date.now();
    if (saida.ok) f.falhas = 0;
    else if (++f.falhas >= config.protecao.falhas_para_pausar) {
      f.pausadoAte = Date.now() + config.protecao.pausa_min * 60000;
      f.falhas = 0;
      logger.warn(`Envios deste número pausados por ${config.protecao.pausa_min} min depois de falhas seguidas.`);
    }
    await concluir(cmd, saida);
  }
  f.rodando = false;
}

async function enviarMensagem(cmd) {
  const p = cmd.payload;
  const sock = motor.socketConectado(cmd.instancia_id);
  const jid = await jidReal(sock, p.para);
  if (!jid) throw new Error('este número não tem WhatsApp');

  // "digitando…" proporcional ao tamanho do texto
  const { presenca_ms_por_caractere, presenca_max_ms } = config.ritmo;
  const presenca = Math.min(presenca_max_ms, Math.max(p.presenca_ms || 0, (p.texto || '').length * presenca_ms_por_caractere));
  if (presenca > 0) {
    try {
      await sock.sendPresenceUpdate(p.tipo === 'audio' ? 'recording' : 'composing', jid);
      await espera(presenca);
      await sock.sendPresenceUpdate('paused', jid);
    } catch (_) {}
  }

  let conteudo;
  if (p.tipo === 'texto') conteudo = { text: p.texto };
  else if (p.tipo === 'imagem') conteudo = { image: { url: p.midia_url }, caption: p.texto };
  else if (p.tipo === 'video') conteudo = { video: { url: p.midia_url }, caption: p.texto };
  else if (p.tipo === 'audio') conteudo = { audio: { url: p.midia_url }, mimetype: 'audio/ogg; codecs=opus', ptt: true };
  else if (p.tipo === 'documento') conteudo = { document: { url: p.midia_url }, fileName: p.nome_arquivo || 'arquivo', caption: p.texto };

  if (p.mencionar_todos && jid.endsWith('@g.us')) {
    const meta = await sock.groupMetadata(jid);
    conteudo.mentions = meta.participants.map((x) => x.id);
  }

  const msg = await sock.sendMessage(jid, conteudo);
  if (msg?.key?.id) motor.enviadosPeloBridge.add(msg.key.id);
  logger.info(`Mensagem enviada para …${String(jid).split('@')[0].slice(-4)}${p.ritmo === 'conversa' ? '' : ' (campanha)'}.`);
  return { wa_id: msg?.key?.id || null };
}

async function executar(cmd) {
  const p = cmd.payload || {};
  try {
    switch (cmd.tipo) {
      case 'instancia.criar':
        await motor.iniciar({ id: cmd.instancia_id, rotulo: p.rotulo, instance_name: p.instance_name });
        return { ok: true, resultado: { iniciado: true } };
      case 'instancia.desconectar':
        await motor.desconectar(cmd.instancia_id);
        return { ok: true };
      case 'instancia.reiniciar':
        await motor.reiniciar({ id: cmd.instancia_id });
        return { ok: true };
      case 'mensagem.enviar':
        return { ok: true, resultado: await enviarMensagem(cmd) };
      case 'numero.validar': {
        const sock = motor.socketConectado(cmd.instancia_id);
        // um por vez: o WhatsApp devolve o JID real (às vezes sem o nono dígito), que não bate com o pedido
        const numeros = [];
        for (const n of p.numeros) {
          const jid = await jidReal(sock, n);
          numeros.push({ numero: n, existe: !!jid, jid });
        }
        return { ok: true, resultado: { numeros } };
      }
      case 'perfil.foto': {
        const sock = motor.socketConectado(cmd.instancia_id);
        let url = null;
        try { url = await sock.profilePictureUrl((await jidReal(sock, p.numero)) || jidDe(p.numero), 'image'); } catch (_) {}
        return { ok: true, resultado: { url } };
      }
      case 'grupos.sincronizar': {
        const sock = motor.socketConectado(cmd.instancia_id);
        const todos = Object.values(await sock.groupFetchAllParticipating());
        const eu = [sock.user?.id, sock.user?.lid].filter(Boolean).map((j) => String(j).split(':')[0].split('@')[0]);
        const souEu = (x) => [x.id, x.phoneNumber, x.lid].some((j) => j && eu.includes(String(j).split(':')[0].split('@')[0]));
        const grupos = todos.map((g) => ({
          jid: g.id,
          nome: g.subject || undefined,
          participantes: g.participants?.length ?? undefined,
          sou_admin: !!g.participants?.find((x) => souEu(x) && x.admin),
        }));
        emitirEvento({ tipo: 'grupos_sincronizados', instancia_id: cmd.instancia_id, dados: { grupos } });
        return { ok: true, resultado: { total: grupos.length } };
      }
      case 'grupo.info': {
        const sock = motor.socketConectado(cmd.instancia_id);
        const g = await sock.groupMetadata(p.jid);
        // participante sem telefone visível (grupo em modo LID) não serve para virar contato: fica de fora
        const participantes = g.participants.map((x) => ({ id: jidTelefone(x), admin: x.admin || null })).filter((x) => x.id);
        return { ok: true, resultado: { jid: g.id, nome: g.subject, descricao: g.desc || null, participantes, ocultos: g.participants.length - participantes.length } };
      }
      case 'grupo.entrar': {
        const sock = motor.socketConectado(cmd.instancia_id);
        return { ok: true, resultado: { jid: await sock.groupAcceptInvite(p.convite) } };
      }
      case 'grupo.atualizar': {
        const sock = motor.socketConectado(cmd.instancia_id);
        if (p.assunto) await sock.groupUpdateSubject(p.jid, p.assunto);
        if (p.descricao !== undefined) await sock.groupUpdateDescription(p.jid, p.descricao);
        return { ok: true };
      }
      default:
        return { ok: false, erro: `comando desconhecido: ${cmd.tipo}` };
    }
  } catch (e) {
    logger.warn(`Comando ${cmd.tipo} falhou: ${e.message}`);
    return { ok: false, erro: e.message };
  }
}
