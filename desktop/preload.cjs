const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whyfailDesktop', Object.freeze({
  selectProject: () => ipcRenderer.invoke('whyfail:select-project'),
  runAutoCheck: (projectPath) => ipcRenderer.invoke('whyfail:run-auto-check', projectPath),
  getSettings: () => ipcRenderer.invoke('whyfail:get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('whyfail:save-settings', settings),
  platform: process.platform
}));
