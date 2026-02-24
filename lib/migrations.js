/**
 * Database migration runner.
 *
 * Stores the current schema version in a `schema_version` table.
 * Each migration is an { id, up } object where `up(db)` is idempotent SQL.
 * Migrations are applied in ascending id order and each runs only once.
 *
 * Usage (in main.js, after initDatabase()):
 *   const { runMigrations } = require('./lib/migrations');
 *   runMigrations(db);
 */
'use strict';

/** Ordered list of migrations. Append new ones — never edit existing ones. */
const MIGRATIONS = [
  {
    id: 1,
    description: 'Create schema_version tracking table',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version   INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
    },
  },
  {
    id: 2,
    description: 'Add source_file column to purchases if missing (pre-1.2 DBs)',
    up(db) {
      const cols = db.prepare(`PRAGMA table_info(purchases)`).all().map(c => c.name);
      if (!cols.includes('source_file')) {
        db.exec(`ALTER TABLE purchases ADD COLUMN source_file TEXT;`);
      }
    },
  },
  {
    id: 3,
    description: 'Add product_id column to purchase_items if missing (pre-1.6 DBs)',
    up(db) {
      const cols = db.prepare(`PRAGMA table_info(purchase_items)`).all().map(c => c.name);
      if (!cols.includes('product_id')) {
        db.exec(`ALTER TABLE purchase_items ADD COLUMN product_id TEXT;`);
      }
    },
  },
];

/**
 * Apply any unapplied migrations to `db` in a single transaction.
 * Safe to call on every startup — already-applied migrations are skipped.
 *
 * @param {import('better-sqlite3').Database} db
 */
function runMigrations(db) {
  // Ensure the version table exists (migration 1 bootstraps it)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version   INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare(`SELECT version FROM schema_version`).all().map(r => r.version)
  );

  const insertVersion = db.prepare(
    `INSERT OR IGNORE INTO schema_version (version) VALUES (?)`
  );

  const applyAll = db.transaction(() => {
    for (const m of MIGRATIONS) {
      if (applied.has(m.id)) { continue; }
      m.up(db);
      insertVersion.run(m.id);
    }
  });

  applyAll();
}

module.exports = { runMigrations, MIGRATIONS };
