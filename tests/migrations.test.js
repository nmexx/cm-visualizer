/**
 * Tests for lib/migrations.js
 */
const Database      = require('better-sqlite3');
const { runMigrations } = require('../lib/migrations');

function freshDb() {
  const db = new Database(':memory:');
  // Bootstrap minimum schema that migrations expect to exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE
    );
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT
    );
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE
    );
  `);
  return db;
}

describe('runMigrations', () => {
  test('creates schema_version table on first run', () => {
    const db = freshDb();
    runMigrations(db);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'").get();
    expect(row).toBeTruthy();
  });

  test('records each migration id in schema_version', () => {
    const db = freshDb();
    runMigrations(db);
    const rows = db.prepare('SELECT version FROM schema_version ORDER BY version').all();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].version).toBe(1);
  });

  test('is idempotent — running twice does not throw or duplicate rows', () => {
    const db = freshDb();
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
    const rows = db.prepare('SELECT version FROM schema_version').all();
    const versions = rows.map(r => r.version);
    const unique   = [...new Set(versions)];
    expect(versions.length).toBe(unique.length);
  });

  test('adds source_file column to purchases table (migration 2)', () => {
    const db = freshDb();
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(purchases)").all();
    const names = cols.map(c => c.name);
    expect(names).toContain('source_file');
  });

  test('adds product_id column to purchase_items table (migration 3)', () => {
    const db = freshDb();
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(purchase_items)").all();
    const names = cols.map(c => c.name);
    expect(names).toContain('product_id');
  });

  test('logs each migration description to console.info when applied', () => {
    const db = freshDb();
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
    runMigrations(db);
    const messages = spy.mock.calls.map(c => String(c[0]));
    spy.mockRestore();
    // Every migration should produce one log line containing its description
    expect(messages.some(m => m.includes('Create schema_version'))).toBe(true);
    expect(messages.some(m => m.includes('source_file'))).toBe(true);
    expect(messages.some(m => m.includes('product_id'))).toBe(true);
  });

  test('does not log on re-run when all migrations are already applied', () => {
    const db = freshDb();
    runMigrations(db); // first run — applies all
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
    runMigrations(db); // second run — nothing to apply
    const callCount = spy.mock.calls.length;
    spy.mockRestore();
    expect(callCount).toBe(0);
  });

  test('wraps a failing migration error with migration id and description', () => {
    const { MIGRATIONS } = require('../lib/migrations');
    const db = freshDb();
    // Temporarily replace migration 2's up() with one that throws
    const original = MIGRATIONS[1].up;
    MIGRATIONS[1].up = () => { throw new Error('intentional test failure'); };
    try {
      expect(() => runMigrations(db)).toThrow(/Migration 2.*Add source_file.*failed/i);
    } finally {
      MIGRATIONS[1].up = original; // always restore
    }
  });
});
