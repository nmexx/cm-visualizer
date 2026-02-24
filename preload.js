const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mtg', {
  // Sold-orders
  selectFolder:         ()         => ipcRenderer.invoke('select-folder'),
  importFolder:         (folder)   => ipcRenderer.invoke('import-folder', folder),
  importFile:           ()         => ipcRenderer.invoke('import-file'),
  getStats:             (filters)  => ipcRenderer.invoke('get-stats', filters),
  setFolderSold:        ()         => ipcRenderer.invoke('set-folder-sold'),
  // Purchased-orders
  importPurchaseFile:   ()         => ipcRenderer.invoke('import-purchase-file'),
  importPurchaseFolder: (folder)   => ipcRenderer.invoke('import-purchase-folder', folder),
  getPurchaseStats:     (filters)  => ipcRenderer.invoke('get-purchase-stats', filters),
  setFolderPurchased:   ()         => ipcRenderer.invoke('set-folder-purchased'),
  // ManaBox inventory
  importInventoryFile:  ()         => ipcRenderer.invoke('import-inventory-file'),
  getInventoryList:     ()         => ipcRenderer.invoke('get-inventory-list'),
  setInventoryFile:     ()         => ipcRenderer.invoke('set-inventory-file'),
  // Market prices (Cardmarket price guide)
  downloadPriceGuide:   ()         => ipcRenderer.invoke('download-price-guide'),
  // Analytics (P&L, Inventory, Repeat Buyers, Set ROI, Foil Premium, Time-to-sell)
  getAnalytics:         (filters)  => ipcRenderer.invoke('get-analytics', filters),
  // Export
  exportCsv:            (type)     => ipcRenderer.invoke('export-csv', type),
  exportXlsx:           (payload)  => ipcRenderer.invoke('export-xlsx', payload),
  // Filter presets
  saveFilterPreset:     (preset)   => ipcRenderer.invoke('save-filter-preset', preset),
  getFilterPresets:     ()         => ipcRenderer.invoke('get-filter-presets'),
  deleteFilterPreset:   (name)     => ipcRenderer.invoke('delete-filter-preset', name),
  // Settings / DB
  getSettings:          ()         => ipcRenderer.invoke('get-settings'),
  getDbPath:            ()         => ipcRenderer.invoke('get-db-path'),
  clearDatabase:        ()         => ipcRenderer.invoke('clear-database'),
  setTheme:             (theme)    => ipcRenderer.invoke('set-theme', theme),
  // Auto-update
  checkForUpdate:       ()         => ipcRenderer.invoke('check-for-update'),
  installUpdate:        ()         => ipcRenderer.invoke('install-update'),
  // Events
  onAutoImport:         (cb) => ipcRenderer.on('auto-import',          (_, d) => cb(d)),
  onAutoImportPurchase: (cb) => ipcRenderer.on('auto-import-purchase', (_, d) => cb(d)),
  onUpdateAvailable:    (cb) => ipcRenderer.on('update-available',    ()    => cb()),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available',()    => cb()),
  onUpdateDownloaded:   (cb) => ipcRenderer.on('update-downloaded',   ()    => cb()),
  onUpdateProgress:     (cb) => ipcRenderer.on('update-progress',     (_, p)=> cb(p)),
});

