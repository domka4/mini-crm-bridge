import { app, BrowserWindow, ipcMain, Tray, Menu, Notification } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { Server as ProxyChainServer } from 'proxy-chain';
import { createPinggyTunnel } from './tunnel.js';

// ---------------------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------------------
let mainWindow, tray = null, proxyServer = null, tunnel = null;
let currentAccountId = null, currentAccessToken = null;

const CRM_API_URL = process.env.VITE_CRM_API_URL || 'https://donovanfeitosa.linkinn.bio';

// ---------------------------------------------------------------------------
// Squirrel (instalador Windows)
// ---------------------------------------------------------------------------
if (started) app.quit();

// ---------------------------------------------------------------------------
// Janela principal
// ---------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 680,
    resizable: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ---------------------------------------------------------------------------
// System Tray
// ---------------------------------------------------------------------------
function createTray() {
  try {
    // Resolve o caminho do ícone tanto em dev quanto em prod
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'icon.png')
      : path.join(__dirname, '..', 'assets', 'icon.png');
    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Mostrar',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      {
        label: 'Sair',
        click: () => {
          app.isQuiting = true;
          app.quit();
        },
      },
    ]);

    tray.setToolTip('Mini CRM Bridge');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  } catch {
    // Ícone não encontrado – ignora silenciosamente
  }
}

// ---------------------------------------------------------------------------
// Helper – garantir que o túnel está ativo
// ---------------------------------------------------------------------------
async function ensureTunnel() {
  if (tunnel && tunnel.url) return tunnel;

  // Cria o servidor proxy local na porta 8000
  if (!proxyServer) {
    proxyServer = new ProxyChainServer({ port: 8000 });
    await new Promise((resolve, reject) => {
      proxyServer.listen((err) => (err ? reject(err) : resolve()));
    });
  }

  // Abre o tunnel via ssh com timeout maior
  try {
    tunnel = await createPinggyTunnel(8000);
  } catch (err) {
    throw new Error('Falha ao conectar túnel TCP: ' + err.message);
  }

  // Atualiza as instâncias no backend com as informações do proxy
  if (currentAccountId && currentAccessToken) {
    const tunnelHost = tunnel.url.split(':')[0];
    const tunnelPort = tunnel.url.split(':')[1];
    const proxyPass = new Date().toISOString();
    
    await fetch(`${CRM_API_URL}/api/crm/wa/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentAccessToken}` },
      body: JSON.stringify({
        account_id: currentAccountId,
        enabled: true,
        proxy_host: tunnelHost,
        proxy_port: tunnelPort,
        proxy_user: 'bridge_online',
        proxy_pass: proxyPass
      })
    }).catch(console.error);
  }

  return tunnel;
}

// ---------------------------------------------------------------------------
// App pronto
// ---------------------------------------------------------------------------
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // AlguÃ©m tentou rodar uma segunda instÃ¢ncia, foca na nossa janela original
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
  });
}

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

ipcMain.handle('save-auth', async (event, data) => {
  const authPath = path.join(app.getPath('userData'), 'auth.json');
  fs.writeFileSync(authPath, JSON.stringify(data));
  return true;
});

ipcMain.handle('load-auth', async () => {
  const authPath = path.join(app.getPath('userData'), 'auth.json');
  if (fs.existsSync(authPath)) {
    try { return JSON.parse(fs.readFileSync(authPath, 'utf8')); } catch(e){}
  }
  return null;
});

ipcMain.handle('clear-auth', async () => {
  const authPath = path.join(app.getPath('userData'), 'auth.json');
  if (fs.existsSync(authPath)) fs.unlinkSync(authPath);
  return true;
});

ipcMain.on('show-notification', (event, { title, body }) => {
  new Notification({
    title,
    body,
    icon: app.isPackaged ? path.join(process.resourcesPath, 'assets', 'icon.png') : path.join(__dirname, '..', 'assets', 'icon.png')
  }).show();
});

// 1. Login -------------------------------------------------------------------
ipcMain.handle('login', async (_event, { email, password }) => {
  try {
    const response = await fetch(`${CRM_API_URL}/api/bridge/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!response.ok) return { success: false, error: data.error || 'Erro na autenticação' };

    currentAccessToken = data.token;
    return { success: true, email: data.email, accounts: data.accounts };
  } catch (err) {
    return { success: false, error: err.message || 'Erro de conexão no login.' };
  }
});

// 2. Selecionar conta --------------------------------------------------------
ipcMain.handle('select-account', async (_event, { account_id }) => {
  try {
    currentAccountId = account_id;

    // Inicia proxy + túnel automaticamente (tenta)
    let tunnelUrl = '';
    try {
      await ensureTunnel();
      if (tunnel) tunnelUrl = tunnel.url;
    } catch(err) {
      console.error('Falha ao iniciar tunel automaticamente:', err);
    }

    return { success: true, tunnelUrl };
  } catch (err) {
    return { success: false, error: err.message || 'Erro ao selecionar conta.' };
  }
});

// 3. Iniciar proxy -----------------------------------------------------------
ipcMain.handle('start-proxy', async () => {
  try {
    await ensureTunnel();
    return { success: true, url: tunnel.url };
  } catch (err) {
    return { success: false, error: err.message || 'Erro ao iniciar proxy.' };
  }
});

// 4. Parar proxy -------------------------------------------------------------
ipcMain.handle('stop-proxy', async () => {
  try {
    if (tunnel) {
      tunnel.close();
      tunnel = null;
    }

    if (proxyServer) {
      await new Promise((resolve) => proxyServer.close(resolve));
      proxyServer = null;
    }

    // Atualiza backend sinalizando que o bridge está offline e desativando proxy nas instâncias
    if (currentAccountId && currentAccessToken) {
      await fetch(`${CRM_API_URL}/api/crm/wa/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentAccessToken}` },
        body: JSON.stringify({
          account_id: currentAccountId,
          enabled: false
        })
      }).catch(console.error);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Erro ao parar proxy.' };
  }
});

// 5. Listar instâncias -------------------------------------------------------
ipcMain.handle('list-instances', async () => {
  try {
    if (!currentAccountId || !currentAccessToken) {
      return { success: false, error: 'Nenhuma conta selecionada.' };
    }

    const response = await fetch(`${CRM_API_URL}/api/bridge/instances?account_id=${currentAccountId}`, {
      headers: { Authorization: `Bearer ${currentAccessToken}` }
    });
    
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.error || 'Erro ao listar instâncias' };

    return { success: true, instancias: data.instances };
  } catch (err) {
    return { success: false, error: err.message || 'Erro de conexão ao listar instâncias.' };
  }
});

// 6. Conectar instância ------------------------------------------------------
ipcMain.handle('connect-instance', async (_event, { instance_name, phone_number }) => {
  try {
    // Garante que o túnel está ativo
    await ensureTunnel();

    const tunnelHost = tunnel.url.split(':')[0];
    const tunnelPort = tunnel.url.split(':')[1];

    const response = await fetch(`${CRM_API_URL}/api/crm/wa/conectar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentAccessToken}`,
      },
      body: JSON.stringify({
        account_id: currentAccountId,
        is_oficial: false,
        instance_name,
        phone_number,
        proxy_host: tunnelHost,
        proxy_port: tunnelPort,
        proxy_user: '',
        proxy_pass: '',
        proxy_type: 'local',
      }),
    });

    const responseBody = await response.json();

    if (response.ok) {
      return {
        success: true,
        qrcode: responseBody.qrcode,
        instance: responseBody.instance,
        estado: responseBody.estado,
      };
    }

    return { success: false, error: responseBody.error || 'Erro na API' };
  } catch {
    return {
      success: false,
      error: 'Não foi possível conectar à API. Verifique sua conexão.',
    };
  }
});

// 7. Deletar instância -------------------------------------------------------
ipcMain.handle('delete-instance', async (_event, { instance_id }) => {
  try {
    if (!currentAccountId || !currentAccessToken) {
      return { success: false, error: 'Nenhuma conta selecionada.' };
    }

    const response = await fetch(`${CRM_API_URL}/api/bridge/instances?account_id=${currentAccountId}&instance_id=${instance_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentAccessToken}` }
    });
    
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.error || 'Erro ao deletar instância' };

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Erro de conexão ao deletar instância.' };
  }
});

// 8. Verificar status da instância -------------------------------------------
ipcMain.handle('check-instance-status', async (_event, { instance_name }) => {
  try {
    if (!currentAccountId || !currentAccessToken) {
      return { success: false, error: 'Nenhuma conta selecionada.' };
    }

    const response = await fetch(`${CRM_API_URL}/api/bridge/instances?account_id=${currentAccountId}&instance_name=${instance_name}`, {
      headers: { Authorization: `Bearer ${currentAccessToken}` }
    });
    
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.error || 'Erro ao verificar status' };

    if (!data.instances || data.instances.length === 0) {
      return { success: false, error: 'Instância não encontrada' };
    }
    
    return { success: true, status: data.instances[0].status, instance: data.instances[0] };
  } catch (err) {
    return { success: false, error: err.message || 'Erro de conexão ao verificar status.' };
  }
});

// 9. Minimizar para tray -----------------------------------------------------
ipcMain.on('minimize-to-tray', () => {
  if (mainWindow) mainWindow.hide();
});

// 10. Fechar aplicação -------------------------------------------------------
ipcMain.on('close-app', () => {
  app.isQuiting = true;
  app.quit();
});
// 11. Reiniciar instancia -----------------------------------------------------
ipcMain.handle('restart-instance', async (_event, { instance_name }) => {
  try {
    const response = await fetch(`${CRM_API_URL}/api/crm/wa/reconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentAccessToken}` },
      body: JSON.stringify({ account_id: currentAccountId, instance_name, action: 'restart' })
    });
    const responseBody = await response.json();
    return response.ok ? { success: true } : { success: false, error: responseBody.error || 'Erro ao reiniciar' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 12. Deslogar instancia ------------------------------------------------------
ipcMain.handle('logout-instance', async (_event, { instance_name }) => {
  try {
    const response = await fetch(`${CRM_API_URL}/api/crm/wa/reconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentAccessToken}` },
      body: JSON.stringify({ account_id: currentAccountId, instance_name, action: 'logout' })
    });
    const responseBody = await response.json();
    return response.ok ? { success: true } : { success: false, error: responseBody.error || 'Erro ao deslogar' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
