'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path     = require('path');
const fs       = require('fs');
const chokidar = require('chokidar');

const { importCSVFile }           = require('./lib/importer');
const { importPurchasedCSVFile }  = require('./lib/purchaseImporter');
const { importInventoryFile }     = require('./lib/inventoryImporter');
const { runMigrations }           = require('./lib/migrations');
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
} catch { /* not available in dev */ }

// --- Application state
let mainWindow     = null;
let db             = null;
let dbPath         = null;
let watcherSold    = null;
let watcherPurchased = null;

/** In-memory map: idProduct (integer) -> price entry. */
const priceGuideCache = new Map();
/** Mutable reference so handlers can read/write the path after app.ready. */
const priceGuide      = { path: null };

// --- Database init
function initDatabase() {
  const Database    = require('better-sqlite3');
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'mtg_sales.db');
  db     = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id          TEXT PRIMARY KEY,
      username          TEXT,
      buyer_name        TEXT,
      city              TEXT,
      country           TEXT,
      is_professional   INTEGER DEFAULT 0,
      date_of_purchase  TEXT,
      article_count     INTEGER,
      merchandise_value REAL,
      shipment_costs    REAL,
      total_value       REAL,
      commission        REAL,
      currency          TEXT,
      source_file       TEXT
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id       TEXT,
      product_id     TEXT,
      card_name      TEXT,
      localized_name TEXT,
      set_name       TEXT,
      collector_num  TEXT,
      rarity         TEXT,
      condition      TEXT,
      language       TEXT,
      is_foil        INTEGER DEFAULT 0,
      quantity       INTEGER DEFAULT 1,
      price          REAL,
      FOREIGN KEY (order_id) REFERENCES orders(order_id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS purchases (
      order_id          TEXT PRIMARY KEY,
      seller_username   TEXT,
      seller_name       TEXT,
      city              TEXT,
      country           TEXT,
      is_professional   INTEGER DEFAULT 0,
      date_of_purchase  TEXT,
      article_count     INTEGER,
      merchandise_value REAL,
      shipment_costs    REAL,
      trustee_fee       REAL,
      total_value       REAL,
      currency          TEXT,
      source_file       TEXT
    );
    CREATE TABLE IF NOT EXISTS purchase_items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id       TEXT,
      product_id     TEXT,
      card_name      TEXT,
      localized_name TEXT,
      set_name       TEXT,
      collector_num  TEXT,
      rarity         TEXT,
      condition      TEXT,
      language       TEXT,
      is_foil        INTEGER DEFAULT 0,
      quantity       INTEGER DEFAULT 1,
      price          REAL,
      FOREIGN KEY (order_id) REFERENCES purchases(order_id)
    );
    CREATE TABLE IF NOT EXISTS manabox_inventory (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      card_name         TEXT NOT NULL,
      set_code          TEXT,
      set_name          TEXT,
      collector_num     TEXT,
      is_foil           INTEGER DEFAULT 0,
      rarity            TEXT,
      quantity          INTEGER DEFAULT 1,
      manabox_id        TEXT,
      scryfall_id       TEXT,
      purchase_price    REAL,
      condition         TEXT,
      language          TEXT,
      purchase_currency TEXT,
      source_file       TEXT
    );
  `);

  runMigrations(db);
  return db;
}

// --- Importer helpers
const importCSVFileWithDB          = fp => importCSVFile(db, fp);
const importPurchasedCSVFileWithDB = fp => importPurchasedCSVFile(db, fp);
const importInventoryFileWithDB    = fp => importInventoryFile(db, fp);

// --- Chokidar auto-watch
function startSoldWatcher(folderPath) {
  watcherSold?.close();
  watcherSold = chokidar.watch(path.join(folderPath, '*.csv'), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
  });
  const handle = fp => {
    try {
      const r = importCSVFileWithDB(fp);
      mainWindow?.webContents.send(CH.AUTO_IMPORT, { file: path.basename(fp), ...r });
    } catch (e) { console.error('Auto-import (sold):', e.message); }
  };
  watcherSold.on('add', handle).on('change', handle);
}

function startPurchasedWatcher(folderPath) {
  watcherPurchased?.close();
  watcherPurchased = chokidar.watch(path.join(folderPath, '*.csv'), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
  });
  const handle = fp => {
    try {
      const r = importPurchasedCSVFileWithDB(fp);
      mainWindow?.webContents.send(CH.AUTO_IMPORT_PURCHASE, { file: path.basename(fp), ...r });
    } catch (e) { console.error('Auto-import (purchased):', e.message); }
  };
  watcherPurchased.on('add', handle).on('change', handle);
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
    try { importInventoryFileWithDB(inventoryFilePath); } catch { /* non-fatal */ }
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) { createWindow(); }
  });
});

app.on('will-quit', () => {
  watcherSold?.close();
  watcherPurchased?.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { app.quit(); }
});
