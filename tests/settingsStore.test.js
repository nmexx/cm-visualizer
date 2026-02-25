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

  // ─── getPresets() ────────────────────────────────────────────────────────

  test('getPresets() returns empty array when no presets exist', () => {
    const store = makeStore();
    expect(store.getPresets()).toEqual([]);
  });

  test('getPresets() returns a saved preset with correct shape', () => {
    const store = makeStore();
    store.set('preset_Q1 2024', JSON.stringify({ from: '2024-01-01', to: '2024-03-31' }));
    const presets = store.getPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0]).toEqual({ name: 'Q1 2024', from: '2024-01-01', to: '2024-03-31' });
  });

  test('getPresets() returns multiple presets', () => {
    const store = makeStore();
    store.set('preset_Alpha', JSON.stringify({ from: '2024-01-01', to: '2024-06-30' }));
    store.set('preset_Beta',  JSON.stringify({ from: '2024-07-01', to: '2024-12-31' }));
    const presets = store.getPresets();
    expect(presets).toHaveLength(2);
    const names = presets.map(p => p.name).sort();
    expect(names).toEqual(['Alpha', 'Beta']);
  });

  test('getPresets() does not return non-preset settings', () => {
    const store = makeStore();
    store.set('theme', 'light');
    store.set('csv_folder_sold', '/data');
    store.set('preset_Only', JSON.stringify({ from: '2024-01-01', to: '2024-12-31' }));
    const presets = store.getPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe('Only');
  });

  test('getPresets() correctly strips the "preset_" prefix from the name', () => {
    const store = makeStore();
    store.set('preset_My Range', JSON.stringify({ from: '2025-01-01', to: '2025-03-31' }));
    const presets = store.getPresets();
    expect(presets[0].name).toBe('My Range');
    expect(presets[0]).not.toHaveProperty('key');
  });

  test('getPresets() skips entries with invalid JSON and warns', () => {
    const store = makeStore();
    store.set('preset_Valid',   JSON.stringify({ from: '2025-01-01', to: '2025-03-31' }));
    store.set('preset_Corrupt', 'NOT_JSON{{');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let presets;
    try {
      presets = store.getPresets();
    } finally {
      // Assert before mockRestore — mockRestore clears mock.calls
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('preset_Corrupt'));
      warnSpy.mockRestore();
    }
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe('Valid');
  });

  test('getPresets() uses cached prepared statement (callable multiple times)', () => {
    const store = makeStore();
    store.set('preset_A', JSON.stringify({ from: '2025-01-01', to: '2025-06-30' }));
    // Should not throw on repeated calls
    expect(store.getPresets()).toHaveLength(1);
    expect(store.getPresets()).toHaveLength(1);
    expect(store.getPresets()).toHaveLength(1);
  });
});
