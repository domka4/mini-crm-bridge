import { CRM_URL, versaoApp } from './config.js';
import { logger } from '../logger.js';

// Canal HTTPS com o Mini CRM (docs/08 §4). Só conexões de saída; nada fica aberto neste PC.

let token = null;
export function definirToken(t) { token = t || null; }

async function chamar(metodo, caminho, corpo, { timeoutMs = 20000 } = {}) {
  const resp = await fetch(CRM_URL + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const erro = new Error(dados.error || `HTTP ${resp.status}`);
    erro.status = resp.status;
    throw erro;
  }
  return dados;
}

export const canal = {
  parear: (codigo, nome) => chamar('POST', '/api/crm/bridge/v2/parear', { codigo, nome, versao: versaoApp() }),
  heartbeat: (instancias, comandos = []) => chamar('POST', '/api/crm/bridge/v2/heartbeat', { versao: versaoApp(), instancias, comandos }),
  comandos: (espera, limite = 5, prioridadeMin = null) => chamar('GET',
    `/api/crm/bridge/v2/comandos?espera=${espera}&limite=${limite}` + (prioridadeMin !== null ? `&prioridade_min=${prioridadeMin}` : ''),
    undefined, { timeoutMs: (espera + 15) * 1000 }),
  resultado: (id, ok, resultado, erro) => chamar('POST', `/api/crm/bridge/v2/comandos/${id}/resultado`, { ok, resultado, erro }),
  criarNumero: (rotulo) => chamar('POST', '/api/crm/bridge/v2/instancias', { rotulo }),
  enviarEventos: (lista) => chamar('POST', '/api/crm/bridge/v2/eventos', lista, { timeoutMs: 60000 }),
};

// Eventos saem em lote (até 50). Se o CRM estiver fora do ar, ficam guardados e tentam de novo.
const fila = [];
let enviando = false;
let agendado = null;

export function emitirEvento(evento) {
  fila.push(evento);
  if (fila.length > 5000) fila.splice(0, fila.length - 5000); // proteção de memória
  agendarEnvio(300);
}

function agendarEnvio(ms) {
  if (agendado) return;
  agendado = setTimeout(() => { agendado = null; esvaziar(); }, ms);
}

async function esvaziar() {
  if (enviando || !fila.length || !token) return;
  enviando = true;
  try {
    while (fila.length) {
      const lote = fila.slice(0, 50);
      const r = await canal.enviarEventos(lote);
      fila.splice(0, lote.length);
      for (const [i, res] of (r.resultados || []).entries()) {
        if (!res.ok) logger.warn(`Evento recusado pelo CRM (${lote[i]?.tipo}): ${res.erro}`);
      }
    }
  } catch (e) {
    logger.warn(`Eventos não enviados, nova tentativa em 10 s: ${e.message}`);
    enviando = false;
    agendarEnvio(10000);
    return;
  }
  enviando = false;
}
