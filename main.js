const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const chokidar = require('chokidar');
const XLSX = require('xlsx');
const { sanitizeDate } = require('./lib/parser');
const { importCSVFile } = require('./lib/importer');
const { importPurchasedCSVFile } = require('./lib/purchaseImporter');
const {
  computeProfitLoss, computeInventory, computeRepeatBuyers,
  computeSetROI, computeFoilPremium, computeTimeToSell,
} = require('./lib/analytics');

// Auto-updater (gracefully no-ops in development/unsigned builds)
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.logger = null;
} catch { /* not available in dev */ }

let mainWindow;
let db;
let dbPath;
let watcher = null;

// ─── Database setup ───────────────────────────────────────────────────────────
function initDatabase() {
  const Database = require('better-sqlite3');
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'mtg_sales.db');

  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id       TEXT PRIMARY KEY,
      username       TEXT,
      buyer_name     TEXT,
      city           TEXT,
      country        TEXT,
      is_professional INTEGER DEFAULT 0,
      date_of_purchase TEXT,
      article_count  INTEGER,
      merchandise_value REAL,
      shipment_costs REAL,
      total_value    REAL,
      commission     REAL,
      currency       TEXT,
      source_file    TEXT
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
  `);

  return db;
}

// ─── Importers ────────────────────────────────────────────────────────────────
function importCSVFileWithDB(filePath) {
  return importCSVFile(db, filePath);
}

function importPurchasedCSVFileWithDB(filePath) {
  return importPurchasedCSVFile(db, filePath);
}

// ─── Chokidar auto-watch ──────────────────────────────────────────────────────
function startWatcher(folderPath) {
  if (watcher) { watcher.close(); watcher = null; }
  watcher = chokidar.watch(path.join(folderPath, '*.csv'), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 }
  });
  const handleFile = (filePath) => {
    try {
      const r = importCSVFileWithDB(filePath);
      mainWindow?.webContents.send('auto-import', { file: path.basename(filePath), ...r });
    } catch (e) { console.error('Auto-import error:', e.message); }
  };
  watcher.on('add', handleFile);
  watcher.on('change', handleFile);
}

// ─── Analytics helpers ────────────────────────────────────────────────────────
/** Compute the previous period of equal length for trend comparison. */
function prevPeriodDates(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) {return { prevFrom: null, prevTo: null };}
  const from = new Date(dateFrom);
  const to   = new Date(dateTo + 'T23:59:59');
  const durationMs = to.getTime() - from.getTime();
  const prevTo   = new Date(from.getTime() - 1);
  const prevFrom = new Date(from.getTime() - durationMs);
  return {
    prevFrom: prevFrom.toISOString().split('T')[0],
    prevTo:   prevTo.toISOString().split('T')[0]
  };
}

/** Detect months with no data in the orders table (between first and last order). */
function detectMissingMonths(table = 'orders') {
  const rows = db.prepare(
    `SELECT DISTINCT substr(date_of_purchase, 1, 7) AS month FROM ${table} ORDER BY month`
  ).all().map(r => r.month);
  if (rows.length < 2) {return [];}
  const missing = [];
  let [y, m] = rows[0].split('-').map(Number);
  const [ey, em] = rows[rows.length - 1].split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (!rows.includes(key)) {missing.push(key);}
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return missing;
}

// ─── Sales analytics ──────────────────────────────────────────────────────────
function getStats(filters = {}) {
  const dateFrom  = sanitizeDate(filters.dateFrom) ?? null;
  const dateTo    = sanitizeDate(filters.dateTo)   ?? null;
  const dateToEnd = dateTo ? dateTo + ' 23:59:59'  : null;

  // All queries use COALESCE to make the filter optional without string interpolation
  const summary = db.prepare(`
    SELECT
      COUNT(*)                  AS total_orders,
      COUNT(DISTINCT username)  AS unique_buyers,
      SUM(article_count)        AS total_articles,
      SUM(merchandise_value)    AS total_revenue,
      SUM(total_value)          AS total_collected,
      SUM(commission)           AS total_commission,
      SUM(shipment_costs)       AS total_shipping,
      AVG(merchandise_value)    AS avg_order_value
    FROM orders
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
  `).get(dateFrom, dateToEnd);

  // Trend: previous period of equal length
  const { prevFrom, prevTo } = prevPeriodDates(dateFrom, dateTo);
  const prevSummary = (prevFrom && prevTo) ? db.prepare(`
    SELECT COUNT(*) AS total_orders, SUM(merchandise_value) AS total_revenue,
           SUM(commission) AS total_commission, SUM(article_count) AS total_articles
    FROM orders WHERE date_of_purchase BETWEEN ? AND ?
  `).get(prevFrom, prevTo + ' 23:59:59') : null;

  const revenueByDay = db.prepare(`
    SELECT substr(date_of_purchase, 1, 10) AS day,
           SUM(merchandise_value) AS revenue, COUNT(*) AS orders
    FROM orders
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY day ORDER BY day
  `).all(dateFrom, dateToEnd);

  const revenueByCountry = db.prepare(`
    SELECT country, COUNT(*) AS orders, SUM(merchandise_value) AS revenue
    FROM orders
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY country ORDER BY revenue DESC LIMIT 15
  `).all(dateFrom, dateToEnd);

  const topCards = db.prepare(`
    SELECT i.card_name, i.set_name, i.rarity,
           SUM(i.quantity) AS qty_sold,
           SUM(i.price * i.quantity) AS revenue,
           SUM(i.price * i.quantity) - SUM(i.price * i.quantity * COALESCE(
             (SELECT commission / NULLIF(merchandise_value,0) FROM orders WHERE order_id = i.order_id), 0
           )) AS net_revenue,
           COUNT(DISTINCT i.order_id) AS in_orders
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
    GROUP BY i.card_name, i.set_name, i.rarity
    ORDER BY revenue DESC LIMIT 20
  `).all(dateFrom, dateToEnd);

  const byRarity = db.prepare(`
    SELECT i.rarity,
           SUM(i.quantity) AS qty,
           SUM(i.price * i.quantity) AS revenue
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
      AND i.rarity != ''
    GROUP BY i.rarity ORDER BY revenue DESC
  `).all(dateFrom, dateToEnd);

  const foilVsNormal = db.prepare(`
    SELECT is_foil, SUM(quantity) AS qty, SUM(price * quantity) AS revenue
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
    GROUP BY is_foil
  `).all(dateFrom, dateToEnd);

  const byLanguage = db.prepare(`
    SELECT i.language, SUM(i.quantity) AS qty, SUM(i.price * i.quantity) AS revenue
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
      AND i.language != ''
    GROUP BY i.language ORDER BY revenue DESC LIMIT 10
  `).all(dateFrom, dateToEnd);

  const bySet = db.prepare(`
    SELECT i.set_name, SUM(i.quantity) AS qty, SUM(i.price * i.quantity) AS revenue
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
      AND i.set_name != ''
    GROUP BY i.set_name ORDER BY revenue DESC LIMIT 15
  `).all(dateFrom, dateToEnd);

  const byCondition = db.prepare(`
    SELECT i.condition, SUM(i.quantity) AS qty, SUM(i.price * i.quantity) AS revenue
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
      AND i.condition != ''
    GROUP BY i.condition ORDER BY qty DESC
  `).all(dateFrom, dateToEnd);

  const allOrders = db.prepare(`
    SELECT order_id, username, buyer_name, country, is_professional, date_of_purchase,
           article_count, merchandise_value, total_value, commission
    FROM orders
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    ORDER BY date_of_purchase DESC
  `).all(dateFrom, dateToEnd);

  const profitByMonth = db.prepare(`
    SELECT substr(date_of_purchase, 1, 7) AS month,
           SUM(merchandise_value) AS revenue,
           SUM(commission) AS commission,
           COUNT(*) AS orders,
           SUM(article_count) AS articles
    FROM orders
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY month ORDER BY month
  `).all(dateFrom, dateToEnd);

  const missingMonths = detectMissingMonths('orders');

  return {
    summary, prevSummary, revenueByDay, revenueByCountry,
    topCards, byRarity, foilVsNormal, byLanguage, bySet,
    byCondition, allOrders, profitByMonth, missingMonths
  };
}

// ─── Purchase analytics ───────────────────────────────────────────────────────
function getPurchaseStats(filters = {}) {
  const dateFrom  = sanitizeDate(filters.dateFrom) ?? null;
  const dateTo    = sanitizeDate(filters.dateTo)   ?? null;
  const dateToEnd = dateTo ? dateTo + ' 23:59:59'  : null;

  const summary = db.prepare(`
    SELECT COUNT(*) AS total_orders, COUNT(DISTINCT seller_username) AS unique_sellers,
           SUM(article_count) AS total_articles, SUM(merchandise_value) AS total_spent,
           SUM(total_value) AS total_paid, SUM(shipment_costs) AS total_shipping,
           SUM(trustee_fee) AS total_fees, AVG(merchandise_value) AS avg_order_value
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
  `).get(dateFrom, dateToEnd);

  const spendByDay = db.prepare(`
    SELECT substr(date_of_purchase, 1, 10) AS day,
           SUM(merchandise_value) AS spent, COUNT(*) AS orders
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY day ORDER BY day
  `).all(dateFrom, dateToEnd);

  const spendByMonth = db.prepare(`
    SELECT substr(date_of_purchase, 1, 7) AS month,
           SUM(merchandise_value) AS spent, SUM(trustee_fee) AS fees, COUNT(*) AS orders
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY month ORDER BY month
  `).all(dateFrom, dateToEnd);

  const topSellers = db.prepare(`
    SELECT seller_username, seller_name, country, is_professional,
           COUNT(*) AS orders, SUM(merchandise_value) AS spent
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY seller_username ORDER BY spent DESC LIMIT 15
  `).all(dateFrom, dateToEnd);

  const topBoughtCards = db.prepare(`
    SELECT i.card_name, i.set_name, i.rarity,
           SUM(i.quantity) AS qty_bought, SUM(i.price * i.quantity) AS spent,
           COUNT(DISTINCT i.order_id) AS in_orders
    FROM purchase_items i
    JOIN purchases p ON p.order_id = i.order_id
    WHERE p.date_of_purchase >= COALESCE(?, p.date_of_purchase)
      AND p.date_of_purchase <= COALESCE(?, p.date_of_purchase)
    GROUP BY i.card_name, i.set_name, i.rarity
    ORDER BY spent DESC LIMIT 20
  `).all(dateFrom, dateToEnd);

  const byRarity = db.prepare(`
    SELECT i.rarity, SUM(i.quantity) AS qty, SUM(i.price * i.quantity) AS spent
    FROM purchase_items i
    JOIN purchases p ON p.order_id = i.order_id
    WHERE p.date_of_purchase >= COALESCE(?, p.date_of_purchase)
      AND p.date_of_purchase <= COALESCE(?, p.date_of_purchase)
      AND i.rarity != ''
    GROUP BY i.rarity ORDER BY spent DESC
  `).all(dateFrom, dateToEnd);

  const byCountry = db.prepare(`
    SELECT country, COUNT(*) AS orders, SUM(merchandise_value) AS spent
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY country ORDER BY spent DESC LIMIT 10
  `).all(dateFrom, dateToEnd);

  const allPurchases = db.prepare(`
    SELECT order_id, seller_username, seller_name, country, is_professional,
           date_of_purchase, article_count, merchandise_value, total_value, trustee_fee
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    ORDER BY date_of_purchase DESC
  `).all(dateFrom, dateToEnd);

  const missingMonths = detectMissingMonths('purchases');

  return { summary, spendByDay, spendByMonth, topSellers, topBoughtCards, byRarity, byCountry, allPurchases, missingMonths };
}

// ─── Analytics (pure-function analytics via lib/analytics.js) ────────────────
function getAnalyticsData(filters = {}) {
  const dateFrom  = sanitizeDate(filters.dateFrom) ?? null;
  const dateTo    = sanitizeDate(filters.dateTo)   ?? null;
  const dateToEnd = dateTo ? dateTo + ' 23:59:59'  : null;

  const soldItems   = db.prepare(`
    SELECT i.card_name, i.set_name, i.rarity, i.quantity, i.price, i.is_foil
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
  `).all(dateFrom, dateToEnd);

  const boughtItems = db.prepare(`
    SELECT i.card_name, i.set_name, i.rarity, i.quantity, i.price, i.is_foil
    FROM purchase_items i
    JOIN purchases p ON p.order_id = i.order_id
    WHERE p.date_of_purchase >= COALESCE(?, p.date_of_purchase)
      AND p.date_of_purchase <= COALESCE(?, p.date_of_purchase)
  `).all(dateFrom, dateToEnd);

  const allSoldItems   = db.prepare(`SELECT i.card_name, i.set_name, i.quantity, i.price, i.is_foil, i.rarity, o.date_of_purchase AS date_of_sale FROM order_items i JOIN orders o ON o.order_id = i.order_id`).all();
  const allBoughtItems = db.prepare(`SELECT i.card_name, i.set_name, i.quantity, i.price, i.is_foil, i.rarity, p.date_of_purchase FROM purchase_items i JOIN purchases p ON p.order_id = i.order_id`).all();

  const allOrders = db.prepare(`
    SELECT username, buyer_name, merchandise_value, article_count
    FROM orders
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
  `).all(dateFrom, dateToEnd);

  return {
    profitLoss:    computeProfitLoss(soldItems, boughtItems),
    inventory:     computeInventory(allBoughtItems, allSoldItems),
    repeatBuyers:  computeRepeatBuyers(allOrders),
    setROI:        computeSetROI(allSoldItems, allBoughtItems),
    foilPremium:   computeFoilPremium(soldItems),
    timeToSell:    computeTimeToSell(allBoughtItems, allSoldItems),
  };
}

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#0a0d14',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();

  // Restore auto-watch if a folder was previously configured
  const savedFolder = db.prepare(`SELECT value FROM settings WHERE key = 'csv_folder'`).get();
  if (savedFolder?.value) {startWatcher(savedFolder.value);}

  // Auto-updater: check on startup in production
  if (autoUpdater && app.isPackaged) {
    autoUpdater.checkForUpdates().catch(() => {});
    autoUpdater.on('update-available',    () => mainWindow?.webContents.send('update-available'));
    autoUpdater.on('update-not-available',() => mainWindow?.webContents.send('update-not-available'));
    autoUpdater.on('error',               () => mainWindow?.webContents.send('update-error'));
    autoUpdater.on('download-progress', p => mainWindow?.webContents.send('update-progress', Math.round(p.percent)));
    autoUpdater.on('update-downloaded',  () => mainWindow?.webContents.send('update-downloaded'));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {createWindow();}
  });
});

app.on('will-quit', () => {
  if (watcher) { watcher.close(); }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {app.quit();}
});

// ─── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select folder containing Cardmarket CSV exports'
  });
  if (result.canceled) {return null;}
  return result.filePaths[0];
});

ipcMain.handle('import-folder', async (_, folderPath) => {
  if (!fs.existsSync(folderPath)) {return { error: 'Folder not found' };}

  const files = fs.readdirSync(folderPath)
    .filter(f => f.toLowerCase().endsWith('.csv'));

  let totalInserted = 0;
  let totalSkipped = 0;
  const results = [];

  for (const file of files) {
    try {
      const r = importCSVFileWithDB(path.join(folderPath, file));
      totalInserted += r.inserted;
      totalSkipped += r.skipped;
      results.push({ file, ...r });
    } catch (e) {
      results.push({ file, error: e.message });
    }
  }

  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('csv_folder', ?)`).run(folderPath);
  startWatcher(folderPath);

  return { totalInserted, totalSkipped, results };
});

ipcMain.handle('import-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    title: 'Select Cardmarket CSV export(s)'
  });
  if (result.canceled) {return null;}

  let totalInserted = 0;
  let totalSkipped = 0;
  const results = [];

  for (const filePath of result.filePaths) {
    try {
      const r = importCSVFileWithDB(filePath);
      totalInserted += r.inserted;
      totalSkipped += r.skipped;
      results.push({ file: path.basename(filePath), ...r });
    } catch (e) {
      results.push({ file: path.basename(filePath), error: e.message });
    }
  }

  return { totalInserted, totalSkipped, results };
});

ipcMain.handle('get-stats', async (_, filters) => {
  return getStats(filters || {});
});

ipcMain.handle('import-purchase-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    title: 'Select Cardmarket Purchased Orders CSV(s)'
  });
  if (result.canceled) {return null;}

  let totalInserted = 0, totalSkipped = 0;
  const results = [];
  for (const filePath of result.filePaths) {
    try {
      const r = importPurchasedCSVFileWithDB(filePath);
      totalInserted += r.inserted;
      totalSkipped  += r.skipped;
      results.push({ file: path.basename(filePath), ...r });
    } catch (e) {
      results.push({ file: path.basename(filePath), error: e.message });
    }
  }
  return { totalInserted, totalSkipped, results };
});

ipcMain.handle('import-purchase-folder', async (_, folderPath) => {
  if (!fs.existsSync(folderPath)) {return { error: 'Folder not found' };}
  const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.csv'));
  let totalInserted = 0, totalSkipped = 0;
  const results = [];
  for (const file of files) {
    try {
      const r = importPurchasedCSVFileWithDB(path.join(folderPath, file));
      totalInserted += r.inserted;
      totalSkipped  += r.skipped;
      results.push({ file, ...r });
    } catch (e) { results.push({ file, error: e.message }); }
  }
  return { totalInserted, totalSkipped, results };
});

ipcMain.handle('get-purchase-stats', async (_, filters) => {
  return getPurchaseStats(filters || {});
});

ipcMain.handle('export-csv', async (_, type) => {
  const date = new Date().toISOString().split('T')[0];
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export as CSV',
    defaultPath: `mtg-${type}-${date}.csv`,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (result.canceled) {return null;}

  let rows = [];
  if (type === 'orders') {
    rows = db.prepare('SELECT order_id,username,buyer_name,country,date_of_purchase,article_count,merchandise_value,shipment_costs,total_value,commission,currency FROM orders ORDER BY date_of_purchase DESC').all();
  } else if (type === 'top-cards') {
    rows = db.prepare('SELECT card_name,set_name,rarity,SUM(quantity) AS qty_sold,SUM(price*quantity) AS revenue FROM order_items GROUP BY card_name,set_name ORDER BY revenue DESC').all();
  } else if (type === 'purchases') {
    rows = db.prepare('SELECT order_id,seller_username,seller_name,country,date_of_purchase,article_count,merchandise_value,shipment_costs,trustee_fee,total_value,currency FROM purchases ORDER BY date_of_purchase DESC').all();
  }

  if (!rows.length) {return { ok: false, message: 'No data to export' };}
  const csv = Object.keys(rows[0]).join(';') + '\n' +
    rows.map(r => Object.values(r).map(v => String(v ?? '').replace(/;/g, ',')).join(';')).join('\n');
  fs.writeFileSync(result.filePath, csv, 'utf-8');
  return { ok: true, path: result.filePath };
});

ipcMain.handle('get-analytics', async (_, filters) => {
  return getAnalyticsData(filters || {});
});

ipcMain.handle('export-xlsx', async (_, { type, rows }) => {
  if (!rows || !rows.length) { return { ok: false, message: 'No data to export' }; }
  const date = new Date().toISOString().split('T')[0];
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export as Excel',
    defaultPath: `mtg-${type}-${date}.xlsx`,
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
  });
  if (result.canceled) { return null; }
  const ws   = XLSX.utils.json_to_sheet(rows);
  const wb   = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, type);
  XLSX.writeFile(wb, result.filePath);
  return { ok: true, path: result.filePath };
});

ipcMain.handle('save-filter-preset', async (_, { name, from, to }) => {
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
    .run('preset_' + name, JSON.stringify({ from, to }));
  return { ok: true };
});

ipcMain.handle('get-filter-presets', async () => {
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key LIKE 'preset_%'`).all();
  return rows.map(r => ({ name: r.key.slice(7), ...JSON.parse(r.value) }));
});

ipcMain.handle('delete-filter-preset', async (_, name) => {
  db.prepare(`DELETE FROM settings WHERE key = ?`).run('preset_' + name);
  return { ok: true };
});

ipcMain.handle('check-for-update', async () => {
  if (!autoUpdater) { return { status: 'unavailable' }; }
  if (!app.isPackaged) { return { status: 'dev' }; }
  try { await autoUpdater.checkForUpdates(); return { status: 'checking' }; }
  catch (e) { return { status: 'error', message: e.message }; }
});

ipcMain.handle('install-update', async () => {
  if (autoUpdater) { autoUpdater.downloadUpdate().catch(() => {}); }
});

ipcMain.handle('set-theme', async (_, theme) => {
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?)`).run(theme);
  return { ok: true };
});

ipcMain.handle('get-settings', async () => {
  const rows = db.prepare(`SELECT key, value FROM settings`).all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
});

ipcMain.handle('get-db-path', async () => dbPath);

ipcMain.handle('clear-database', async () => {
  db.exec(`DELETE FROM order_items; DELETE FROM orders; DELETE FROM purchase_items; DELETE FROM purchases;`);
  return { ok: true };
});
