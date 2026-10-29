import { logger } from '../logger.js';
import * as cofre from './cofre.js';
import { canal, definirToken } from './canal.js';
import { compararVersoes, versaoApp } from './config.js';
import * as motor from './motor.js';
import * as executor from './executor.js';
import { verificarAgora } from './atualizacao.js';

// Orquestra o Bridge 2.0: pareamento, heartbeat, busca de comandos e números (docs/08).

// crmOnline: null = ainda sem o primeiro heartbeat
let estado = { pareado: false, conta: null, dispositivo: null, crmOnline: null, bloqueadoPorVersao: false, versaoMinima: null, aviso: null };
let ativo = false;
let aoMudar = () => {};
let timerHeartbeat = null;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
function mudar(novo) { estado = { ...estado, ...novo }; aoMudar(obterEstado()); }

export function quandoMudar(fn) {
  aoMudar = fn;
  motor.quandoMudar(() => aoMudar(obterEstado()));
}

export function obterEstado() {
  return { ...estado, versao: versaoApp(), numeros: motor.listarNumeros(), enviosNaFila: executor.enviosPendentes() };
}

export async function iniciar() {
  const salvo = cofre.ler('dispositivo');
  if (!salvo?.token) { mudar({ pareado: false }); return; }
  definirToken(salvo.token);
  mudar({ pareado: true, conta: salvo.conta, dispositivo: salvo.dispositivo, aviso: null });
  ligarCiclos();
}

export async function parear(codigo, nome) {
  const r = await canal.parear(codigo, nome);
  cofre.salvar('dispositivo', { token: r.token, conta: r.conta, dispositivo: r.dispositivo });
  definirToken(r.token);
  logger.info(`PC pareado com a conta "${r.conta?.nome}".`);
  mudar({ pareado: true, conta: r.conta, dispositivo: r.dispositivo, aviso: null });
  ligarCiclos();
  return obterEstado();
}

/** "Desparear este PC": desconecta os números, apaga sessões e o token. */
export async function desparear() {
  pararCiclos();
  for (const n of motor.listarNumeros()) {
    await motor.desconectar(n.id);
    motor.esquecer(n.id);
  }
  cofre.apagar('dispositivo');
  cofre.apagar('executados');
  definirToken(null);
  mudar({ pareado: false, conta: null, dispositivo: null, crmOnline: null, aviso: null });
}

export async function adicionarNumero(rotulo) {
  const r = await canal.criarNumero(rotulo);
  await motor.iniciar(r.instancia);
  return obterEstado();
}

export async function conectarNumero(id) {
  const n = motor.listarNumeros().find((x) => x.id === id);
  await motor.iniciar({ id, rotulo: n?.rotulo });
  return obterEstado();
}

export async function desconectarNumero(id) {
  await motor.desconectar(id);
  return obterEstado();
}

export function encerrar() {
  pararCiclos();
  motor.pararTodas();
}

function ligarCiclos() {
  if (ativo) return;
  ativo = true;
  cicloHeartbeat();
  cicloComandos();
}

function pararCiclos() {
  ativo = false;
  if (timerHeartbeat) clearTimeout(timerHeartbeat);
  timerHeartbeat = null;
}

function revogado() {
  logger.warn('O Mini CRM recusou este PC (token revogado). Pareie de novo.');
  pararCiclos();
  motor.pararTodas();
  cofre.apagar('dispositivo');
  definirToken(null);
  mudar({ pareado: false, crmOnline: false, aviso: 'Este PC foi desconectado no Mini CRM. Gere um código novo e pareie de novo.' });
}

async function cicloHeartbeat() {
  if (!ativo) return;
  let proximo = 60;
  try {
    const r = await canal.heartbeat(motor.estadosParaHeartbeat());
    executor.definirConfig(r.config);
    proximo = r.config?.heartbeat_s || 60;
    const bloqueado = compararVersoes(versaoApp(), r.config?.versao_minima || '0.0.0') < 0;
    if (bloqueado && !estado.bloqueadoPorVersao) {
      logger.warn(`Esta versão (${versaoApp()}) está abaixo da mínima (${r.config.versao_minima}). Envios pausados até atualizar.`);
      verificarAgora();
    }
    mudar({ crmOnline: true, bloqueadoPorVersao: bloqueado, versaoMinima: r.config?.versao_minima || null });

    // números da conta ligados a este PC: reconecta os que já têm sessão, mostra os outros
    const daConta = new Set();
    for (const inst of r.instancias || []) {
      daConta.add(inst.id);
      if (motor.temSessaoSalva(inst.id)) await motor.iniciar(inst);
      else motor.conhecer(inst);
    }
    for (const n of motor.listarNumeros()) if (!daConta.has(n.id)) motor.esquecer(n.id);
  } catch (e) {
    if (e.status === 401) return revogado();
    mudar({ crmOnline: false });
    logger.warn(`Sem contato com o Mini CRM: ${e.message}`);
    proximo = 20;
  }
  if (ativo) timerHeartbeat = setTimeout(cicloHeartbeat, proximo * 1000);
}

async function cicloComandos() {
  while (ativo) {
    // versão abaixo da mínima ou fila local cheia: não pega comando novo (o prazo do CRM é de 2 min)
    if (estado.bloqueadoPorVersao || executor.enviosPendentes() > 1) { await espera(3000); continue; }
    try {
      const r = await canal.comandos(25);
      for (const cmd of r.comandos || []) executor.receber(cmd);
      if (r.comandos?.length) aoMudar(obterEstado());
    } catch (e) {
      if (e.status === 401) { revogado(); return; }
      await espera(5000);
    }
  }
}
