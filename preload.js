const { contextBridge, ipcRenderer } = require('electron');

// Channel name constants — must be kept in sync with lib/ipcChannels.js
// (cannot require local files from a sandboxed preload)
const CH = {
  SELECT_FOLDER:          'select-folder',
  IMPORT_FOLDER:          'import-folder',
  IMPORT_FILE:            'import-file',
  IMPORT_FILE_PATH:       'import-file-path',
  IMPORT_PURCHASE_FILE:   'import-purchase-file',
  IMPORT_PURCHASE_FOLDER: 'import-purchase-folder',
  IMPORT_INVENTORY_FILE:  'import-inventory-file',
  SET_INVENTORY_FILE:     'set-inventory-file',
  SET_FOLDER_SOLD:        'set-folder-sold',
  SET_FOLDER_PURCHASED:   'set-folder-purchased',
  GET_STATS:              'get-stats',
  GET_PURCHASE_STATS:     'get-purchase-stats',
  GET_ANALYTICS:          'get-analytics',
  GET_INVENTORY_LIST:     'get-inventory-list',
  EXPORT_CSV:             'export-csv',
  EXPORT_XLSX:            'export-xlsx',
  GET_SETTINGS:           'get-settings',
  GET_DB_PATH:            'get-db-path',
  SET_THEME:              'set-theme',
  SAVE_FILTER_PRESET:     'save-filter-preset',
  GET_FILTER_PRESETS:     'get-filter-presets',
  DELETE_FILTER_PRESET:   'delete-filter-preset',
  CLEAR_DATABASE:         'clear-database',
  DOWNLOAD_PRICE_GUIDE:   'download-price-guide',
  CHECK_FOR_UPDATE:       'check-for-update',
  INSTALL_UPDATE:         'install-update',
  AUTO_IMPORT:            'auto-import',
  AUTO_IMPORT_PURCHASE:   'auto-import-purchase',
  UPDATE_AVAILABLE:       'update-available',
  UPDATE_NOT_AVAILABLE:   'update-not-available',
  UPDATE_ERROR:           'update-error',
  UPDATE_PROGRESS:        'update-progress',
  UPDATE_DOWNLOADED:      'update-downloaded',
};

contextBridge.exposeInMainWorld('mtg', {
  // Sold-orders
  selectFolder:         ()        => ipcRenderer.invoke(CH.SELECT_FOLDER),
  importFolder:         folder    => ipcRenderer.invoke(CH.IMPORT_FOLDER, folder),
  importFile:           ()        => ipcRenderer.invoke(CH.IMPORT_FILE),
  importFilePath:       filePath  => ipcRenderer.invoke(CH.IMPORT_FILE_PATH, filePath),
  getStats:             filters   => ipcRenderer.invoke(CH.GET_STATS, filters),
  setFolderSold:        ()        => ipcRenderer.invoke(CH.SET_FOLDER_SOLD),
  // Purchased-orders
  importPurchaseFile:   ()        => ipcRenderer.invoke(CH.IMPORT_PURCHASE_FILE),
  importPurchaseFolder: folder    => ipcRenderer.invoke(CH.IMPORT_PURCHASE_FOLDER, folder),
  getPurchaseStats:     filters   => ipcRenderer.invoke(CH.GET_PURCHASE_STATS, filters),
  setFolderPurchased:   ()        => ipcRenderer.invoke(CH.SET_FOLDER_PURCHASED),
  // ManaBox inventory
  importInventoryFile:  ()        => ipcRenderer.invoke(CH.IMPORT_INVENTORY_FILE),
  getInventoryList:     ()        => ipcRenderer.invoke(CH.GET_INVENTORY_LIST),
  setInventoryFile:     ()        => ipcRenderer.invoke(CH.SET_INVENTORY_FILE),
  // Market prices
  downloadPriceGuide:   ()        => ipcRenderer.invoke(CH.DOWNLOAD_PRICE_GUIDE),
  // Analytics
  getAnalytics:         filters   => ipcRenderer.invoke(CH.GET_ANALYTICS, filters),
  // Export
  exportCsv:            type      => ipcRenderer.invoke(CH.EXPORT_CSV, type),
  exportXlsx:           payload   => ipcRenderer.invoke(CH.EXPORT_XLSX, payload),
  // Filter presets
  saveFilterPreset:     preset    => ipcRenderer.invoke(CH.SAVE_FILTER_PRESET, preset),
  getFilterPresets:     ()        => ipcRenderer.invoke(CH.GET_FILTER_PRESETS),
  deleteFilterPreset:   name      => ipcRenderer.invoke(CH.DELETE_FILTER_PRESET, name),
  // Settings / DB
  getSettings:          ()        => ipcRenderer.invoke(CH.GET_SETTINGS),
  getDbPath:            ()        => ipcRenderer.invoke(CH.GET_DB_PATH),
  clearDatabase:        ()        => ipcRenderer.invoke(CH.CLEAR_DATABASE),
  setTheme:             theme     => ipcRenderer.invoke(CH.SET_THEME, theme),
  // Auto-update
  checkForUpdate:       ()        => ipcRenderer.invoke(CH.CHECK_FOR_UPDATE),
  installUpdate:        ()        => ipcRenderer.invoke(CH.INSTALL_UPDATE),
  // Push notifications (main -> renderer)
  onAutoImport:         cb => ipcRenderer.on(CH.AUTO_IMPORT,          (_, d) => cb(d)),
  onAutoImportPurchase: cb => ipcRenderer.on(CH.AUTO_IMPORT_PURCHASE, (_, d) => cb(d)),
  onUpdateAvailable:    cb => ipcRenderer.on(CH.UPDATE_AVAILABLE,     ()     => cb()),
  onUpdateNotAvailable: cb => ipcRenderer.on(CH.UPDATE_NOT_AVAILABLE, ()     => cb()),
  onUpdateDownloaded:   cb => ipcRenderer.on(CH.UPDATE_DOWNLOADED,    ()     => cb()),
  onUpdateProgress:     cb => ipcRenderer.on(CH.UPDATE_PROGRESS,      (_, p) => cb(p)),
});
