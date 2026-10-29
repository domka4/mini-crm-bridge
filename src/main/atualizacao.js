import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { logger } from '../logger.js';

// Atualização automática do Bridge e do Baileys embutido (docs/08 §6.1).
// GitHub Releases do repo público domka4/mini-crm-bridge. Canal beta = pré-lançamentos.
// Só roda no app instalado; em desenvolvimento não há o que atualizar.

let estado = { status: 'atual', versao: null };
let aoMudar = () => {};
let podeReiniciar = () => true;
let ligado = false;

function mudar(novo) { estado = { ...estado, ...novo }; aoMudar(estado); }
export function estadoAtualizacao() { return estado; }

export function iniciarAtualizacoes({ beta = false, seguroReiniciar, quandoMudar }) {
  if (quandoMudar) aoMudar = quandoMudar;
  if (seguroReiniciar) podeReiniciar = seguroReiniciar;
  if (!app.isPackaged) {
    mudar({ status: 'dev' });
    return;
  }
  ligado = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = !!beta;
  autoUpdater.logger = null;

  autoUpdater.on('checking-for-update', () => mudar({ status: 'procurando' }));
  autoUpdater.on('update-available', (i) => { mudar({ status: 'baixando', versao: i.version }); logger.info(`Baixando a versão ${i.version}…`); });
  autoUpdater.on('update-not-available', () => mudar({ status: 'atual', versao: null }));
  autoUpdater.on('error', (e) => { mudar({ status: 'erro' }); logger.warn(`Atualização falhou: ${e.message}`); });
  autoUpdater.on('update-downloaded', (i) => {
    mudar({ status: 'pronta', versao: i.version });
    logger.info(`Versão ${i.version} pronta. Instala assim que não houver envio em andamento.`);
    const tentar = () => {
      if (podeReiniciar()) autoUpdater.quitAndInstall(true, true);
      else setTimeout(tentar, 30000);
    };
    tentar();
  });

  verificarAgora();
  setInterval(verificarAgora, 6 * 3600 * 1000);
}

export function verificarAgora() {
  if (!ligado) return;
  autoUpdater.checkForUpdates().catch((e) => logger.warn(`Não consegui procurar atualização: ${e.message}`));
}

export function definirBeta(beta) {
  if (!ligado) return;
  autoUpdater.allowPrerelease = !!beta;
  verificarAgora();
}
