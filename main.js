'use strict';

const { app, BrowserWindow } = require('electron');
const path     = require('path');
const fs       = require('fs');
const chokidar = require('chokidar');

const { importCSVFile }           = require('./lib/importer');
const { importPurchasedCSVFile }  = require('./lib/purchaseImporter');
const { importInventoryFile }     = require('./lib/inventoryImporter');
const { runMigrations }           = require('./lib/migrations');
const { BASELINE_DDL }            = require('./lib/schema');
const { SettingsStore }           = require('./lib/settingsStore');
const { loadPriceGuideIntoCache } = require('./lib/priceGuide');
const CH                          = require('./lib/ipcChannels');

const fileHandlers      = require('./ipc/fileHandlers');
const settingsHandlers  = require('./ipc/settingsHandlers');
const analyticsHandlers = require('./ipc/analyticsHandlers');

// --- Auto-updater
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.logger       = null;
} catch (e) { console.info('[updater] not available:', e.message); }

// --- Application state
let mainWindow     = null;
let db             = null;
let dbPath         = null;
let watcherSold    = null;
let watcherPurchased = null;

/** In-memory map: idProduct (integer) -> price entry. */
const priceGuideCache = new Map();
/**
 * Wrapped in an object so handler modules that receive this reference by value
 * at registration time can still observe the `.path` set later in app.whenReady().
 */
const priceGuide      = { path: null };

// --- Database init
function initDatabase() {
  const Database    = require('better-sqlite3');
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'mtg_sales.db');
  db     = new Database(dbPath);

  db.exec(BASELINE_DDL);

  runMigrations(db);
  return db;
}

// --- Importer helpers
const importCSVFileWithDB          = fp => importCSVFile(db, fp);
const importPurchasedCSVFileWithDB = fp => importPurchasedCSVFile(db, fp);
const importInventoryFileWithDB    = fp => importInventoryFile(db, fp);

// --- Chokidar auto-watch
/**
 * Start (or restart) a CSV folder watcher.
 * @param {'sold'|'purchased'} kind         - used only for logging
 * @param {string}             folderPath
 * @param {(fp: string) => object} importFn - called with the absolute CSV path
 * @param {string}             channel      - IPC push channel for the renderer
 * @returns {import('chokidar').FSWatcher}
 */
function startWatcher(kind, folderPath, importFn, channel) {
  const watcher = chokidar.watch(path.join(folderPath, '*.csv'), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
  });
  const handle = fp => {
    try {
      const r = importFn(fp);
      mainWindow?.webContents.send(channel, { file: path.basename(fp), ...r });
    } catch (e) { console.error(`Auto-import (${kind}):`, e.message); }
  };
  watcher.on('add', handle).on('change', handle);
  return watcher;
}

function startSoldWatcher(folderPath) {
  watcherSold?.close();
  watcherSold = startWatcher('sold', folderPath, importCSVFileWithDB, CH.AUTO_IMPORT);
}

function startPurchasedWatcher(folderPath) {
  watcherPurchased?.close();
  watcherPurchased = startWatcher('purchased', folderPath, importPurchasedCSVFileWithDB, CH.AUTO_IMPORT_PURCHASE);
}

// --- Window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 650,
    backgroundColor: '#0a0d14',
    icon: path.join(__dirname, 'CM_Visualizer.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload requires Node.js (require) to load lib/ipcChannels
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

// --- Register IPC handlers
function registerHandlers(settings) {
  const ctx = {
    db,
    dbPath,
    settings,
    priceGuideCache,
    priceGuide,
    autoUpdater,
    getMainWindow:               () => mainWindow,
    importCSVFileWithDB,
    importPurchasedCSVFileWithDB,
    importInventoryFileWithDB,
    startSoldWatcher,
    startPurchasedWatcher,
  };

  fileHandlers.register(ctx);
  settingsHandlers.register(ctx);
  analyticsHandlers.register(ctx);
}

// --- Startup
app.whenReady().then(() => {
  initDatabase();
  const settings = new SettingsStore(db);

  createWindow();
  registerHandlers(settings);

  // Restore file watchers from persisted settings
  const soldFolder      = settings.get('csv_folder_sold') || settings.get('csv_folder');
  const purchasedFolder = settings.get('csv_folder_purchased');
  if (soldFolder)      { startSoldWatcher(soldFolder); }
  if (purchasedFolder) { startPurchasedWatcher(purchasedFolder); }

  // Load cached price guide into memory
  priceGuide.path = path.join(app.getPath('userData'), 'price_guide.json');
  loadPriceGuideIntoCache(priceGuide.path, priceGuideCache);

  // Auto-import persisted inventory file
  const inventoryFilePath = settings.get('inventory_file_path');
  if (inventoryFilePath && fs.existsSync(inventoryFilePath)) {
    try { importInventoryFileWithDB(inventoryFilePath); }
    catch (e) { console.warn('[startup] inventory auto-import failed:', e.message); }
  }

  // Auto-updater (production only)
  if (autoUpdater && app.isPackaged) {
    autoUpdater.checkForUpdates().catch(() => {});
    autoUpdater.on('update-available',     () => mainWindow?.webContents.send(CH.UPDATE_AVAILABLE));
    autoUpdater.on('update-not-available', () => mainWindow?.webContents.send(CH.UPDATE_NOT_AVAILABLE));
    autoUpdater.on('error',                () => mainWindow?.webContents.send(CH.UPDATE_ERROR));
    autoUpdater.on('download-progress', p  => mainWindow?.webContents.send(CH.UPDATE_PROGRESS, Math.round(p.percent)));
    autoUpdater.on('update-downloaded',    () => mainWindow?.webContents.send(CH.UPDATE_DOWNLOADED));
  }
});

// macOS: re-create the window when the dock icon is clicked and no windows are open.
// Registered at module level (not inside whenReady) so it is active from the start.
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) { createWindow(); }
});

app.on('will-quit', () => {
  watcherSold?.close();
  watcherPurchased?.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { app.quit(); }
});
