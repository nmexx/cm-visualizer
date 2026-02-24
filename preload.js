const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mtg', {
  // Sold-orders
  selectFolder:         ()         => ipcRenderer.invoke('select-folder'),
  importFolder:         (folder)   => ipcRenderer.invoke('import-folder', folder),
  importFile:           ()         => ipcRenderer.invoke('import-file'),
  getStats:             (filters)  => ipcRenderer.invoke('get-stats', filters),
  // Purchased-orders
  importPurchaseFile:   ()         => ipcRenderer.invoke('import-purchase-file'),
  importPurchaseFolder: (folder)   => ipcRenderer.invoke('import-purchase-folder', folder),
  getPurchaseStats:     (filters)  => ipcRenderer.invoke('get-purchase-stats', filters),
  // Shared
  exportCsv:            (type)     => ipcRenderer.invoke('export-csv', type),
  getSettings:          ()         => ipcRenderer.invoke('get-settings'),
  getDbPath:            ()         => ipcRenderer.invoke('get-db-path'),
  clearDatabase:        ()         => ipcRenderer.invoke('clear-database'),
  // Auto-import event
  onAutoImport: (cb) => ipcRenderer.on('auto-import', (_, data) => cb(data)),
});
