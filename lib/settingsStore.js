/**
 * Typed wrapper around the `settings` SQLite table.
 * Provides named getters/setters and default values, replacing raw
 * `db.prepare("INSERT OR REPLACE INTO settings ...").run(key, value)` calls
 * scattered throughout main.js.
 */
'use strict';

/** Default values returned when a key has never been written. */
const DEFAULTS = {
  theme:                  'dark',
  csv_folder_sold:        null,
  csv_folder:             null,   // legacy alias for csv_folder_sold
  csv_folder_purchased:   null,
  inventory_file_path:    null,
  price_guide_updated_at: null,
};

class SettingsStore {
  /**
   * @param {import('better-sqlite3').Database} db
   */
  constructor(db) {
    this._getStmt  = db.prepare('SELECT value FROM settings WHERE key = ?');
    this._setStmt  = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    this._allStmt  = db.prepare('SELECT key, value FROM settings');
    this._delStmt  = db.prepare('DELETE FROM settings WHERE key = ?');
  }

  /**
   * Read a single setting value.
   * @param {string} key
   * @returns {string|null}
   */
  get(key) {
    const row = this._getStmt.get(key);
    return row != null ? row.value : (DEFAULTS[key] ?? null);
  }

  /**
   * Write a single setting value.
   * @param {string} key
   * @param {string|null} value
   */
  set(key, value) {
    this._setStmt.run(key, value);
  }

  /**
   * Delete a setting.
   * @param {string} key
   */
  delete(key) {
    this._delStmt.run(key);
  }

  /**
   * Return all settings as a plain object.
   * @returns {Record<string, string>}
   */
  getAll() {
    const rows = this._allStmt.all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }
}

module.exports = { SettingsStore, SETTINGS_DEFAULTS: DEFAULTS };
