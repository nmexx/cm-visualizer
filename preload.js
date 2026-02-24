const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mtg', {
  selectFolder:    ()         => ipcRenderer.invoke('select-folder'),
  importFolder:    (folder)   => ipcRenderer.invoke('import-folder', folder),
  importFile:      ()         => ipcRenderer.invoke('import-file'),
  getStats:        (filters)  => ipcRenderer.invoke('get-stats', filters),
  getSettings:     ()         => ipcRenderer.invoke('get-settings'),
  getDbPath:       ()         => ipcRenderer.invoke('get-db-path'),
  clearDatabase:   ()         => ipcRenderer.invoke('clear-database'),
});
