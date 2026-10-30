const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kraDesktop', {
  isDesktop: true,
  platform: process.platform,
  selectFolder: () => ipcRenderer.invoke('kra:select-folder'),
  openExternal: (url) => ipcRenderer.invoke('kra:open-external', url),
  getAppInfo: () => ipcRenderer.invoke('kra:get-app-info'),
  getRuntimeStatus: () => ipcRenderer.invoke('kra:get-runtime-status'),
});
