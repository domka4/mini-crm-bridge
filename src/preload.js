const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridgeAPI', {
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  selectAccount: (data) => ipcRenderer.invoke('select-account', data),
  startProxy: () => ipcRenderer.invoke('start-proxy'),
  stopProxy: () => ipcRenderer.invoke('stop-proxy'),
  listInstances: () => ipcRenderer.invoke('list-instances'),
  connectInstance: (data) => ipcRenderer.invoke('connect-instance', data),
  deleteInstance: (data) => ipcRenderer.invoke('delete-instance', data),
  checkInstanceStatus: (data) => ipcRenderer.invoke('check-instance-status', data),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  closeApp: () => ipcRenderer.send('close-app'),
  saveAuth: (data) => ipcRenderer.invoke('save-auth', data),
  loadAuth: () => ipcRenderer.invoke('load-auth'),
  clearAuth: () => ipcRenderer.invoke('clear-auth'),
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
});
