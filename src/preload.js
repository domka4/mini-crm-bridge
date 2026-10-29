const { contextBridge, ipcRenderer } = require('electron');

// Única porta entre a tela e o processo principal. A tela não acessa Node, arquivos nem a rede.

function ouvir(canal, fn) {
  const h = (_e, dado) => fn(dado);
  ipcRenderer.on(canal, h);
  return () => ipcRenderer.removeListener(canal, h);
}

contextBridge.exposeInMainWorld('bridge', {
  estado: () => ipcRenderer.invoke('estado'),
  parear: (codigo, nome) => ipcRenderer.invoke('parear', codigo, nome),
  adicionarNumero: (rotulo, visibilidade) => ipcRenderer.invoke('adicionar-numero', rotulo, visibilidade),
  conectarNumero: (id) => ipcRenderer.invoke('conectar-numero', id),
  desconectarNumero: (id) => ipcRenderer.invoke('desconectar-numero', id),
  desparear: () => ipcRenderer.invoke('desparear'),
  logs: () => ipcRenderer.invoke('logs'),
  abrirCrm: () => ipcRenderer.invoke('abrir-crm'),
  procurarAtualizacao: () => ipcRenderer.invoke('procurar-atualizacao'),
  preferencias: (novas) => ipcRenderer.invoke('preferencias', novas),
  aoMudarEstado: (fn) => ouvir('estado', fn),
  aoNovoLog: (fn) => ouvir('new-log', fn),
});
