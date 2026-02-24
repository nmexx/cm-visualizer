/**
 * IPC handlers for settings, filter presets, database utilities and auto-updater.
 */
'use strict';

const { ipcMain, app } = require('electron');
const CH = require('../lib/ipcChannels');

/**
 * @param {object} ctx
 * @param {import('better-sqlite3').Database}               ctx.db
 * @param {string}                                          ctx.dbPath
 * @param {import('../lib/settingsStore').SettingsStore}    ctx.settings
 * @param {object|null}                                     ctx.autoUpdater
 * @param {() => Electron.BrowserWindow|null}               ctx.getMainWindow
 */
function register(ctx) {
  const { db, settings, autoUpdater, getMainWindow } = ctx;

  // ─── Fetch all settings + app version ─────────────────────────────────────
  ipcMain.handle(CH.GET_SETTINGS, async () => {
    const all = settings.getAll();
    all.version = app.getVersion();
    return all;
  });

  // ─── Database file path ────────────────────────────────────────────────────
  ipcMain.handle(CH.GET_DB_PATH, async () => ctx.dbPath);

  // ─── Theme ────────────────────────────────────────────────────────────────
  ipcMain.handle(CH.SET_THEME, async (_, theme) => {
    settings.set('theme', theme);
    return { ok: true };
  });

  // ─── Filter presets ────────────────────────────────────────────────────────
  ipcMain.handle(CH.SAVE_FILTER_PRESET, async (_, { name, from, to }) => {
    settings.set('preset_' + name, JSON.stringify({ from, to }));
    return { ok: true };
  });

  ipcMain.handle(CH.GET_FILTER_PRESETS, async () => {
    const rows = db.prepare(`SELECT key, value FROM settings WHERE key LIKE 'preset_%'`).all();
    return rows.map(r => ({ name: r.key.slice(7), ...JSON.parse(r.value) }));
  });

  ipcMain.handle(CH.DELETE_FILTER_PRESET, async (_, name) => {
    settings.delete('preset_' + name);
    return { ok: true };
  });

  // ─── Clear all sales / purchase data ──────────────────────────────────────
  ipcMain.handle(CH.CLEAR_DATABASE, async () => {
    db.exec(`
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM purchase_items;
      DELETE FROM purchases;
    `);
    return { ok: true };
  });

  // ─── Auto-updater ──────────────────────────────────────────────────────────
  ipcMain.handle(CH.CHECK_FOR_UPDATE, async () => {
    if (!autoUpdater)     { return { status: 'unavailable' }; }
    if (!app.isPackaged)  { return { status: 'dev' }; }
    try {
      await autoUpdater.checkForUpdates();
      return { status: 'checking' };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  });

  ipcMain.handle(CH.INSTALL_UPDATE, async () => {
    autoUpdater?.downloadUpdate().catch(() => {});
  });
}

module.exports = { register };
