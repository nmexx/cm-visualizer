const { contextBridge, ipcRenderer } = require('electron');

// Channel name constants — sourced from lib/ipcChannels.js (preload has full
// Node.js access because sandbox: false is set in the BrowserWindow webPreferences).
const CH = require('./lib/ipcChannels');

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
  getOrderItems:        payload   => ipcRenderer.invoke(CH.GET_ORDER_ITEMS, payload),
  setPurchaseItemsExcludeFromPL: payload => ipcRenderer.invoke(CH.SET_PURCHASE_ITEMS_EXCLUDE_FROM_PL, payload),
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
