'use strict';

/**
 * IPC channel name constants — single source of truth used by main.js, preload.js,
 * and the renderer modules. Typos fail at require-time rather than silently at runtime.
 *
 * PUSH_CHANNELS lists the subset of channels that flow main → renderer
 * (ipcRenderer.on / webContents.send). All other channels are request/response
 * (ipcMain.handle / ipcRenderer.invoke).
 */

const CHANNELS = {
  // ─── File / folder import ─────────────────────────────────────────────────
  SELECT_FOLDER:           'select-folder',
  IMPORT_FOLDER:           'import-folder',
  IMPORT_FILE:             'import-file',
  IMPORT_FILE_PATH:        'import-file-path',
  IMPORT_PURCHASE_FILE:    'import-purchase-file',
  IMPORT_PURCHASE_FOLDER:  'import-purchase-folder',
  IMPORT_INVENTORY_FILE:   'import-inventory-file',
  SET_INVENTORY_FILE:      'set-inventory-file',
  SET_FOLDER_SOLD:         'set-folder-sold',
  SET_FOLDER_PURCHASED:    'set-folder-purchased',

  // ─── Data queries ─────────────────────────────────────────────────────────
  GET_STATS:               'get-stats',
  GET_PURCHASE_STATS:      'get-purchase-stats',
  GET_ANALYTICS:           'get-analytics',
  GET_INVENTORY_LIST:      'get-inventory-list',

  // ─── Export ───────────────────────────────────────────────────────────────
  EXPORT_CSV:              'export-csv',
  EXPORT_XLSX:             'export-xlsx',

  // ─── Settings ─────────────────────────────────────────────────────────────
  GET_SETTINGS:            'get-settings',
  GET_DB_PATH:             'get-db-path',
  SET_THEME:               'set-theme',
  SAVE_FILTER_PRESET:      'save-filter-preset',
  GET_FILTER_PRESETS:      'get-filter-presets',
  DELETE_FILTER_PRESET:    'delete-filter-preset',
  CLEAR_DATABASE:          'clear-database',

  // ─── Price guide ──────────────────────────────────────────────────────────
  DOWNLOAD_PRICE_GUIDE:    'download-price-guide',

  // ─── Auto-updater ─────────────────────────────────────────────────────────
  CHECK_FOR_UPDATE:        'check-for-update',
  INSTALL_UPDATE:          'install-update',

  // ─── Push notifications (main → renderer) ────────────────────────────────
  AUTO_IMPORT:             'auto-import',
  AUTO_IMPORT_PURCHASE:    'auto-import-purchase',
  UPDATE_AVAILABLE:        'update-available',
  UPDATE_NOT_AVAILABLE:    'update-not-available',
  UPDATE_ERROR:            'update-error',
  UPDATE_PROGRESS:         'update-progress',
  UPDATE_DOWNLOADED:       'update-downloaded',
};

/**
 * Set of channel names that are push notifications (main → renderer).
 * Callers should use ipcRenderer.on() for these, not ipcRenderer.invoke().
 */
const PUSH_CHANNELS = new Set([
  CHANNELS.AUTO_IMPORT,
  CHANNELS.AUTO_IMPORT_PURCHASE,
  CHANNELS.UPDATE_AVAILABLE,
  CHANNELS.UPDATE_NOT_AVAILABLE,
  CHANNELS.UPDATE_ERROR,
  CHANNELS.UPDATE_PROGRESS,
  CHANNELS.UPDATE_DOWNLOADED,
]);

module.exports = Object.freeze({ ...CHANNELS, PUSH_CHANNELS });
