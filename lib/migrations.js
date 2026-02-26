/**
 * Database migration runner.
 *
 * Stores the current schema version in a `schema_version` table.
 * Each migration is an { id, description, up } object where `up(db)` is idempotent SQL.
 * Migrations are applied in ascending id order and each runs only once.
 *
 * Usage (in main.js, after initDatabase()):
 *   const { runMigrations } = require('./lib/migrations');
 *   runMigrations(db);
 */
'use strict';

/** DDL for the version-tracking table — shared by the bootstrap and migration 1. */
const SCHEMA_VERSION_DDL = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

/** Ordered list of migrations. Append new ones — never edit existing ones. */
const MIGRATIONS = [
  {
    id: 1,
    description: 'Create schema_version tracking table',
    up(db) {
      db.exec(SCHEMA_VERSION_DDL);
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
  {
    id: 4,
    description: 'Add UNIQUE constraint to manabox_inventory (card_name, scryfall_id, is_foil, condition, language)',
    up(db) {
      // Check if the unique constraint already exists by trying to create it
      // SQLite doesn't support adding constraints, so we recreate the table if needed
      const hasConstraint = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='manabox_inventory' AND sql LIKE '%UNIQUE%'
      `).get();
      
      if (hasConstraint) { return; } // Already has UNIQUE constraint

      // Rename old table
      db.exec(`ALTER TABLE manabox_inventory RENAME TO manabox_inventory_old;`);

      // Create new table with UNIQUE constraint
      db.exec(`
        CREATE TABLE manabox_inventory (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          card_name         TEXT NOT NULL,
          set_code          TEXT,
          set_name          TEXT,
          collector_num     TEXT,
          is_foil           INTEGER DEFAULT 0,
          rarity            TEXT,
          quantity          INTEGER DEFAULT 1,
          manabox_id        TEXT,
          scryfall_id       TEXT,
          purchase_price    REAL,
          condition         TEXT,
          language          TEXT,
          purchase_currency TEXT,
          source_file       TEXT,
          UNIQUE(card_name, scryfall_id, is_foil, condition, language)
        );
      `);

      // Copy data from old table, ignoring duplicates
      db.exec(`
        INSERT OR IGNORE INTO manabox_inventory
          (card_name, set_code, set_name, collector_num, is_foil, rarity,
           quantity, manabox_id, scryfall_id, purchase_price,
           condition, language, purchase_currency, source_file)
        SELECT
          card_name, set_code, set_name, collector_num, is_foil, rarity,
          quantity, manabox_id, scryfall_id, purchase_price,
          condition, language, purchase_currency, source_file
        FROM manabox_inventory_old;
      `);

      // Drop old table
      db.exec(`DROP TABLE manabox_inventory_old;`);
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
  db.exec(SCHEMA_VERSION_DDL);

  const applied = new Set(
    db.prepare(`SELECT version FROM schema_version`).all().map(r => r.version)
  );

  const insertVersion = db.prepare(
    `INSERT OR IGNORE INTO schema_version (version) VALUES (?)`
  );

  const applyAll = db.transaction(() => {
    for (const m of MIGRATIONS) {
      if (applied.has(m.id)) { continue; }
      try {
        m.up(db);
      } catch (e) {
        throw new Error(`Migration ${m.id} (${m.description}) failed: ${e.message}`);
      }
      insertVersion.run(m.id);
      console.info(`[migrations] applied migration ${m.id}: ${m.description}`);
    }
  });

  applyAll();
}

module.exports = { runMigrations, MIGRATIONS };
