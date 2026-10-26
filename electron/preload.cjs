const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  windowControl: (action) => ipcRenderer.invoke('window:control', action),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onWindowMaximized: (callback) => {
    const listener = (event, maximized) => callback(Boolean(maximized));
    ipcRenderer.on('window:maximized', listener);
    return () => ipcRenderer.removeListener('window:maximized', listener);
  },
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (doc) => ipcRenderer.invoke('data:save', doc),
  dataInfo: () => ipcRenderer.invoke('data:info'),
  openDataFolder: () => ipcRenderer.invoke('data:open-folder'),
  backupData: () => ipcRenderer.invoke('data:backup'),
  restoreData: () => ipcRenderer.invoke('data:restore'),
});
