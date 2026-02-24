/**
 * Tests for lib/settingsStore.js
 */
const Database    = require('better-sqlite3');
const { SettingsStore } = require('../lib/settingsStore');

function makeStore() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
  return new SettingsStore(db);
}

describe('SettingsStore', () => {
  test('get() returns default when key is absent', () => {
    const store = makeStore();
    expect(store.get('theme')).toBe('dark');
  });

  test('get() returns null default for unknown key with no default', () => {
    const store = makeStore();
    expect(store.get('nonexistent_key')).toBeNull();
  });

  test('set() persists a value, get() returns it', () => {
    const store = makeStore();
    store.set('theme', 'light');
    expect(store.get('theme')).toBe('light');
  });

  test('set() overwrites an existing value', () => {
    const store = makeStore();
    store.set('theme', 'light');
    store.set('theme', 'dark');
    expect(store.get('theme')).toBe('dark');
  });

  test('set() stores values and get() returns them as stored', () => {
    const store = makeStore();
    store.set('csv_folder', '/my/path');
    expect(store.get('csv_folder')).toBe('/my/path');
  });

  test('delete() removes a key, get() returns default afterwards', () => {
    const store = makeStore();
    store.set('theme', 'light');
    store.delete('theme');
    expect(store.get('theme')).toBe('dark');
  });

  test('getAll() returns stored values as a plain object', () => {
    const store = makeStore();
    store.set('csv_folder_sold', '/data/sold');
    store.set('theme', 'light');
    const all = store.getAll();
    expect(all.theme).toBe('light');
    expect(all.csv_folder_sold).toBe('/data/sold');
  });

  test('getAll() returns plain object (not class instance)', () => {
    const store = makeStore();
    const all = store.getAll();
    expect(typeof all).toBe('object');
    expect(Array.isArray(all)).toBe(false);
  });
});
