const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const { sanitizeDate } = require('./lib/parser');
const { importCSVFile } = require('./lib/importer');

let mainWindow;
let db;
let dbPath;

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
  `);

  return db;
}

// ─── CSV Parser + Importer (see lib/parser.js, lib/importer.js) ─────────────
// Thin wrapper binding the shared db instance:
function importCSVFileWithDB(filePath) {
  return importCSVFile(db, filePath);
}

// ─── Analytics queries ────────────────────────────────────────────────────────
function getStats(filters = {}) {
  const dateFrom = sanitizeDate(filters.dateFrom);
  const dateTo   = sanitizeDate(filters.dateTo);
  let where = '1=1';

  if (dateFrom) { where += ` AND date_of_purchase >= '${dateFrom}'`; }
  if (dateTo)   { where += ` AND date_of_purchase <= '${dateTo} 23:59:59'`; }

  const summary = db.prepare(`
    SELECT
      COUNT(*)             AS total_orders,
      COUNT(DISTINCT username) AS unique_buyers,
      SUM(article_count)   AS total_articles,
      SUM(merchandise_value) AS total_revenue,
      SUM(total_value)     AS total_collected,
      SUM(commission)      AS total_commission,
      SUM(shipment_costs)  AS total_shipping,
      AVG(merchandise_value) AS avg_order_value
    FROM orders WHERE ${where}
  `).get();

  const revenueByDay = db.prepare(`
    SELECT substr(date_of_purchase, 1, 10) AS day,
           SUM(merchandise_value) AS revenue,
           COUNT(*) AS orders
    FROM orders WHERE ${where}
    GROUP BY day ORDER BY day
  `).all();

  const revenueByCountry = db.prepare(`
    SELECT country, COUNT(*) AS orders, SUM(merchandise_value) AS revenue
    FROM orders WHERE ${where}
    GROUP BY country ORDER BY revenue DESC LIMIT 15
  `).all();

  const topCards = db.prepare(`
    SELECT i.card_name, i.set_name, i.rarity,
           SUM(i.quantity) AS qty_sold,
           SUM(i.price * i.quantity) AS revenue,
           COUNT(DISTINCT i.order_id) AS in_orders
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE ${where.replace(/date_of_purchase/g, 'o.date_of_purchase')}
    GROUP BY i.card_name, i.set_name, i.rarity
    ORDER BY revenue DESC LIMIT 20
  `).all();

  const byRarity = db.prepare(`
    SELECT i.rarity,
           SUM(i.quantity) AS qty,
           SUM(i.price * i.quantity) AS revenue
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE ${where.replace(/date_of_purchase/g, 'o.date_of_purchase')}
      AND i.rarity != ''
    GROUP BY i.rarity ORDER BY revenue DESC
  `).all();

  const foilVsNormal = db.prepare(`
    SELECT is_foil,
           SUM(quantity) AS qty,
           SUM(price * quantity) AS revenue
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE ${where.replace(/date_of_purchase/g, 'o.date_of_purchase')}
    GROUP BY is_foil
  `).all();

  const byLanguage = db.prepare(`
    SELECT i.language,
           SUM(i.quantity) AS qty,
           SUM(i.price * i.quantity) AS revenue
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE ${where.replace(/date_of_purchase/g, 'o.date_of_purchase')}
      AND i.language != ''
    GROUP BY i.language ORDER BY revenue DESC LIMIT 10
  `).all();

  const bySet = db.prepare(`
    SELECT i.set_name,
           SUM(i.quantity) AS qty,
           SUM(i.price * i.quantity) AS revenue
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE ${where.replace(/date_of_purchase/g, 'o.date_of_purchase')}
      AND i.set_name != ''
    GROUP BY i.set_name ORDER BY revenue DESC LIMIT 15
  `).all();

  const recentOrders = db.prepare(`
    SELECT order_id, username, buyer_name, country, is_professional, date_of_purchase,
           article_count, merchandise_value, total_value, commission
    FROM orders WHERE ${where}
    ORDER BY date_of_purchase DESC LIMIT 50
  `).all();

  const profitByMonth = db.prepare(`
    SELECT substr(date_of_purchase, 1, 7) AS month,
           SUM(merchandise_value) AS revenue,
           SUM(commission) AS commission,
           COUNT(*) AS orders,
           SUM(article_count) AS articles
    FROM orders WHERE ${where}
    GROUP BY month ORDER BY month
  `).all();

  return {
    summary,
    revenueByDay,
    revenueByCountry,
    topCards,
    byRarity,
    foilVsNormal,
    byLanguage,
    bySet,
    recentOrders,
    profitByMonth
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
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {createWindow();}
  });
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

  // Save folder in settings
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('csv_folder', ?)`).run(folderPath);

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

ipcMain.handle('get-settings', async () => {
  const rows = db.prepare(`SELECT key, value FROM settings`).all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
});

ipcMain.handle('get-db-path', async () => dbPath);

ipcMain.handle('clear-database', async () => {
  db.exec(`DELETE FROM order_items; DELETE FROM orders;`);
  return { ok: true };
});
