import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, nativeTheme, shell } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { logger, setMainWindowForLogs, getLogs } from './logger.js';
import { ICONE_BANDEJA } from './main/icone.js';
import { CRM_URL } from './main/config.js';
import * as cofre from './main/cofre.js';
import * as servico from './main/servico.js';
import * as executor from './main/executor.js';
import { iniciarAtualizacoes, estadoAtualizacao, definirBeta, verificarAgora } from './main/atualizacao.js';

// Mini CRM Bridge 2.0 (docs/08): o WhatsApp dos números da conta roda neste PC,
// na mesma rede do celular, e conversa com o Mini CRM só por conexões de saída.

if (started) app.quit();

let janela = null;
let bandeja = null;
let saindo = false;
const PREFERENCIAS_PADRAO = { iniciarComWindows: true, beta: false };

function preferencias() {
  return { ...PREFERENCIAS_PADRAO, ...(cofre.ler('preferencias') || {}) };
}

function aplicarInicioComWindows(ligar) {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: !!ligar, args: ['--oculto'] });
}

function estadoCompleto() {
  return { ...servico.obterEstado(), atualizacao: estadoAtualizacao(), preferencias: preferencias(), nomePc: os.hostname() };
}

function enviarEstado() {
  if (janela && !janela.isDestroyed()) janela.webContents.send('estado', estadoCompleto());
  atualizarBandeja();
}

function mostrarJanela() {
  if (!janela) return;
  if (janela.isMinimized()) janela.restore();
  janela.show();
  janela.focus();
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 460,
    height: 760,
    minWidth: 400,
    minHeight: 560,
    show: false,
    title: 'Mini CRM Bridge',
    icon: nativeImage.createFromDataURL(ICONE_BANDEJA),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121411' : '#F4F5F3', // mesmo fundo da tela, sem piscar
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) janela.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  else janela.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));

  // links externos abrem no navegador; a janela do Bridge nunca navega para fora
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  janela.webContents.on('will-navigate', (e) => e.preventDefault());

  janela.once('ready-to-show', () => {
    if (!process.argv.includes('--oculto')) janela.show();
  });
  janela.on('close', (e) => {
    if (saindo) return;
    e.preventDefault();
    janela.hide(); // fechar a janela não para o WhatsApp; o Bridge continua na bandeja
  });

  setMainWindowForLogs(janela);
}

function rotuloDaBandeja() {
  const e = servico.obterEstado();
  if (!e.pareado) return 'Mini CRM Bridge: não pareado';
  const conectados = e.numeros.filter((n) => n.estado === 'conectado').length;
  return `Mini CRM Bridge: ${conectados} de ${e.numeros.length} número(s) conectado(s)`;
}

function atualizarBandeja() {
  if (bandeja) bandeja.setToolTip(rotuloDaBandeja());
}

function criarBandeja() {
  bandeja = new Tray(nativeImage.createFromDataURL(ICONE_BANDEJA));
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir o Bridge', click: mostrarJanela },
    { label: 'Abrir o Mini CRM', click: () => shell.openExternal(CRM_URL + '/crm') },
    { type: 'separator' },
    { label: 'Sair (o WhatsApp para de funcionar no CRM)', click: () => { saindo = true; app.quit(); } },
  ]));
  bandeja.on('click', mostrarJanela);
  atualizarBandeja();
}

/** O Bridge 1.x guardava o token da conta em texto puro (achado P0-10). Some com ele. */
function limparBridgeAntigo() {
  try { fs.rmSync(path.join(app.getPath('appData'), 'mini-crm-bridge', 'auth.json'), { force: true }); } catch (_) {}
}

// IPC: cada canal devolve { ok, dados } ou { ok: false, erro } para a tela
function tratar(nome, fn) {
  ipcMain.handle(nome, async (_e, ...args) => {
    try {
      return { ok: true, dados: await fn(...args) };
    } catch (e) {
      logger.warn(`${nome}: ${e.message}`);
      return { ok: false, erro: e.message };
    }
  });
}

tratar('estado', () => estadoCompleto());
tratar('parear', (codigo, nome) => servico.parear(String(codigo || ''), String(nome || os.hostname()).slice(0, 60)));
tratar('adicionar-numero', (rotulo) => servico.adicionarNumero(String(rotulo || '').slice(0, 40)));
tratar('conectar-numero', (id) => servico.conectarNumero(id));
tratar('desconectar-numero', (id) => servico.desconectarNumero(id));
tratar('desparear', () => servico.desparear());
tratar('logs', () => getLogs());
tratar('abrir-crm', () => shell.openExternal(CRM_URL + '/crm'));
tratar('procurar-atualizacao', () => verificarAgora());
tratar('preferencias', (novas = {}) => {
  const atuais = preferencias();
  const p = {
    iniciarComWindows: typeof novas.iniciarComWindows === 'boolean' ? novas.iniciarComWindows : atuais.iniciarComWindows,
    beta: typeof novas.beta === 'boolean' ? novas.beta : atuais.beta,
  };
  cofre.salvar('preferencias', p);
  aplicarInicioComWindows(p.iniciarComWindows);
  if (p.beta !== atuais.beta) definirBeta(p.beta);
  enviarEstado();
  return p;
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', mostrarJanela);

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.minicrm.bridge');
    limparBridgeAntigo();
    criarJanela();
    criarBandeja();
    const prefs = preferencias();
    aplicarInicioComWindows(prefs.iniciarComWindows);

    servico.quandoMudar(enviarEstado);
    iniciarAtualizacoes({
      beta: prefs.beta,
      seguroReiniciar: () => executor.enviosPendentes() === 0,
      quandoMudar: enviarEstado,
    });
    logger.info(`Mini CRM Bridge ${app.getVersion()} iniciado.`);
    await servico.iniciar();
  });
}

app.on('before-quit', () => {
  saindo = true;
  servico.encerrar();
});

// o Bridge vive na bandeja: fechar a janela não encerra o app
app.on('window-all-closed', () => {});
