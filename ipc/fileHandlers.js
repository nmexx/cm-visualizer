/**
 * IPC handlers for all file / folder import and export operations.
 *
 * register(ctx) wires up ipcMain.handle() for every import/export channel.
 * Context properties used:
 *   db, getMainWindow, settings, importCSVFileWithDB, importPurchasedCSVFileWithDB,
 *   importInventoryFileWithDB, startSoldWatcher, startPurchasedWatcher
 */
'use strict';

const { ipcMain, dialog } = require('electron');
const path  = require('path');
const fs    = require('fs');
const XLSX  = require('xlsx');
const CH    = require('../lib/ipcChannels');

/**
 * @param {object} ctx
 * @param {import('better-sqlite3').Database}               ctx.db
 * @param {() => Electron.BrowserWindow|null}               ctx.getMainWindow
 * @param {import('../lib/settingsStore').SettingsStore}     ctx.settings
 * @param {(fp: string) => object}  ctx.importCSVFileWithDB
 * @param {(fp: string) => object}  ctx.importPurchasedCSVFileWithDB
 * @param {(fp: string) => object}  ctx.importInventoryFileWithDB
 * @param {(folder: string) => void} ctx.startSoldWatcher
 * @param {(folder: string) => void} ctx.startPurchasedWatcher
 */
function register(ctx) {
  const {
    db, getMainWindow, settings,
    importCSVFileWithDB, importPurchasedCSVFileWithDB, importInventoryFileWithDB,
    startSoldWatcher, startPurchasedWatcher,
  } = ctx;

  // ─── Folder picker (generic, returns path string) ─────────────────────────
  ipcMain.handle(CH.SELECT_FOLDER, async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select folder containing Cardmarket CSV exports',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // ─── Import sold-orders folder ─────────────────────────────────────────────
  ipcMain.handle(CH.IMPORT_FOLDER, async (_, folderPath) => {
    if (!fs.existsSync(folderPath)) { return { error: 'Folder not found' }; }

    const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.csv'));
    let totalInserted = 0, totalSkipped = 0;
    const results = [];

    for (const file of files) {
      try {
        const r = importCSVFileWithDB(path.join(folderPath, file));
        totalInserted += r.inserted;
        totalSkipped  += r.skipped;
        results.push({ file, ...r });
      } catch (e) {
        results.push({ file, error: e.message });
      }
    }

    settings.set('csv_folder_sold', folderPath);
    startSoldWatcher(folderPath);
    return { totalInserted, totalSkipped, results };
  });

  // ─── Import sold-orders – programmatic file path (drag-drop) ──────────────
  ipcMain.handle(CH.IMPORT_FILE_PATH, async (_, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) { return { error: 'File not found' }; }
    try {
      const r = importCSVFileWithDB(filePath);
      return { totalInserted: r.inserted, totalSkipped: r.skipped };
    } catch (e) {
      return { error: e.message };
    }
  });

  // ─── Import sold-orders – file picker ─────────────────────────────────────
  ipcMain.handle(CH.IMPORT_FILE, async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      title: 'Select Cardmarket CSV export(s)',
    });
    if (result.canceled) { return null; }

    let totalInserted = 0, totalSkipped = 0;
    const results = [];
    for (const filePath of result.filePaths) {
      try {
        const r = importCSVFileWithDB(filePath);
        totalInserted += r.inserted;
        totalSkipped  += r.skipped;
        results.push({ file: path.basename(filePath), ...r });
      } catch (e) {
        results.push({ file: path.basename(filePath), error: e.message });
      }
    }
    return { totalInserted, totalSkipped, results };
  });

  // ─── Set watched sold-orders folder ───────────────────────────────────────
  ipcMain.handle(CH.SET_FOLDER_SOLD, async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select folder to auto-watch for Sold CSV exports',
    });
    if (result.canceled) { return null; }
    const folderPath = result.filePaths[0];
    settings.set('csv_folder_sold', folderPath);
    startSoldWatcher(folderPath);
    return folderPath;
  });

  // ─── Import purchased-orders – file picker ────────────────────────────────
  ipcMain.handle(CH.IMPORT_PURCHASE_FILE, async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      title: 'Select Cardmarket Purchased Orders CSV(s)',
    });
    if (result.canceled) { return null; }

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

  // ─── Import purchased-orders folder ───────────────────────────────────────
  ipcMain.handle(CH.IMPORT_PURCHASE_FOLDER, async (_, folderPath) => {
    if (!fs.existsSync(folderPath)) { return { error: 'Folder not found' }; }
    const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.csv'));
    let totalInserted = 0, totalSkipped = 0;
    const results = [];
    for (const file of files) {
      try {
        const r = importPurchasedCSVFileWithDB(path.join(folderPath, file));
        totalInserted += r.inserted;
        totalSkipped  += r.skipped;
        results.push({ file, ...r });
      } catch (e) {
        results.push({ file, error: e.message });
      }
    }
    settings.set('csv_folder_purchased', folderPath);
    startPurchasedWatcher(folderPath);
    return { totalInserted, totalSkipped, results };
  });

  // ─── Set watched purchased-orders folder ──────────────────────────────────
  ipcMain.handle(CH.SET_FOLDER_PURCHASED, async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select folder to auto-watch for Purchased CSV exports',
    });
    if (result.canceled) { return null; }
    const folderPath = result.filePaths[0];
    settings.set('csv_folder_purchased', folderPath);
    startPurchasedWatcher(folderPath);
    return folderPath;
  });

  // ─── Import ManaBox inventory – file picker ────────────────────────────────
  ipcMain.handle(CH.IMPORT_INVENTORY_FILE, async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      title: 'Select ManaBox Inventory CSV(s)',
    });
    if (result.canceled) { return null; }

    let totalInserted = 0, totalSkipped = 0;
    const results = [];
    for (const filePath of result.filePaths) {
      try {
        const r = importInventoryFileWithDB(filePath);
        totalInserted += r.inserted;
        totalSkipped  += r.skipped;
        results.push({ file: path.basename(filePath), ...r });
      } catch (e) {
        results.push({ file: path.basename(filePath), error: e.message });
      }
    }
    return { totalInserted, totalSkipped, results };
  });

  // ─── Persist ManaBox inventory file path ──────────────────────────────────
  ipcMain.handle(CH.SET_INVENTORY_FILE, async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      title: 'Select ManaBox Inventory CSV',
    });
    if (result.canceled) { return null; }
    const filePath = result.filePaths[0];
    settings.set('inventory_file_path', filePath);
    try {
      const r = importInventoryFileWithDB(filePath);
      return { path: filePath, ...r };
    } catch (e) {
      return { path: filePath, error: e.message };
    }
  });

  // ─── Get ManaBox inventory list ────────────────────────────────────────────
  ipcMain.handle(CH.GET_INVENTORY_LIST, async () => {
    return db.prepare(`
      SELECT card_name, set_code, set_name, collector_num, is_foil, rarity,
             quantity, manabox_id, scryfall_id, purchase_price,
             condition, language, purchase_currency, source_file
      FROM manabox_inventory
      ORDER BY card_name ASC
    `).all();
  });

  // ─── Export CSV ────────────────────────────────────────────────────────────
  ipcMain.handle(CH.EXPORT_CSV, async (_, payload) => {
    const type       = typeof payload === 'string' ? payload : payload?.type;
    const passedRows = typeof payload === 'object' && payload?.rows ? payload.rows : null;
    const win  = getMainWindow();
    const date = new Date().toISOString().split('T')[0];
    const result = await dialog.showSaveDialog(win, {
      title: 'Export as CSV',
      defaultPath: `mtg-${type}-${date}.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });
    if (result.canceled) { return null; }

    let rows = passedRows || [];
    if (!passedRows) {
      if (type === 'orders') {
        rows = db.prepare('SELECT order_id,username,buyer_name,country,date_of_purchase,article_count,merchandise_value,shipment_costs,total_value,commission,currency FROM orders ORDER BY date_of_purchase DESC').all();
      } else if (type === 'top-cards') {
        rows = db.prepare('SELECT card_name,set_name,rarity,SUM(quantity) AS qty_sold,SUM(price*quantity) AS revenue FROM order_items GROUP BY card_name,set_name ORDER BY revenue DESC').all();
      } else if (type === 'purchases') {
        rows = db.prepare('SELECT order_id,seller_username,seller_name,country,date_of_purchase,article_count,merchandise_value,shipment_costs,trustee_fee,total_value,currency FROM purchases ORDER BY date_of_purchase DESC').all();
      }
    }

    if (!rows.length) { return { ok: false, message: 'No data to export' }; }
    const csv = Object.keys(rows[0]).join(';') + '\n' +
      rows.map(r => Object.values(r).map(v => String(v ?? '').replace(/;/g, ',')).join(';')).join('\n');
    fs.writeFileSync(result.filePath, csv, 'utf-8');
    return { ok: true, path: result.filePath };
  });

  // ─── Export XLSX ───────────────────────────────────────────────────────────
  ipcMain.handle(CH.EXPORT_XLSX, async (_, { type, rows }) => {
    if (!rows || !rows.length) { return { ok: false, message: 'No data to export' }; }
    const win  = getMainWindow();
    const date = new Date().toISOString().split('T')[0];
    const result = await dialog.showSaveDialog(win, {
      title: 'Export as Excel',
      defaultPath: `mtg-${type}-${date}.xlsx`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    });
    if (result.canceled) { return null; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type);
    XLSX.writeFile(wb, result.filePath);
    return { ok: true, path: result.filePath };
  });
}

module.exports = { register };
