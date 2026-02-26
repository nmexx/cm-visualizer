'use strict';

const fs   = require('fs');
const path = require('path');
const { parseDelimitedLine } = require('./parser');

/**
 * Parse a ManaBox-style inventory CSV and insert new rows into manabox_inventory.
 * Duplicate rows (same card_name + scryfall_id + is_foil + condition + language)
 * are silently skipped due to a UNIQUE constraint. To refresh the entire inventory,
 * clear the table first.
 *
 * Expected CSV columns (comma-separated, may be quoted):
 *   Name, Set code, Set name, Collector number, Foil, Rarity, Quantity,
 *   ManaBox ID, Scryfall ID, Purchase price, Misprint, Altered,
 *   Condition, Language, Purchase price currency
 *
 * Note: Misprint and Altered columns are present in the file but are not stored.
 *
 * @param {object} db   - better-sqlite3 database instance
 * @param {string} filePath
 * @returns {{ inserted: number, skipped: number }}
 */
function importInventoryFile(db, filePath) {
  const raw   = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {return { inserted: 0, skipped: 0 };}

  const headers = parseCSVLine(lines[0]);
  const col     = {};
  headers.forEach((h, i) => { col[h.trim()] = i; });

  if (col['Name'] === undefined) {throw new Error('Missing required column: Name');}
  if (col['Scryfall ID'] === undefined) {throw new Error('Missing required column: Scryfall ID');}

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO manabox_inventory
      (card_name, set_code, set_name, collector_num, is_foil, rarity,
       quantity, manabox_id, scryfall_id, purchase_price,
       condition, language, purchase_currency, source_file)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  // Batch insert: process 5000 rows at a time to avoid holding entire file in memory
  const BATCH_SIZE = 5000;
  const insertBatch = db.transaction((rows) => {
    let inserted = 0;
    for (const row of rows) {
      const info = stmt.run(...row);
      if (info && info.changes > 0) {inserted++;}
    }
    return inserted;
  });

  const sourceFile = path.basename(filePath);
  let totalInserted = 0;
  let batchRows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const name = vals[col['Name']];
    if (!name || !name.trim()) {continue;}

    batchRows.push([
      name.trim(),
      (vals[col['Set code']]          || '').trim(),
      (vals[col['Set name']]          || '').trim(),
      (vals[col['Collector number']]  || '').trim(),
      (vals[col['Foil']]              || '').trim().toLowerCase() === 'foil' ? 1 : 0,
      (vals[col['Rarity']]            || '').trim(),
      (() => { const q = parseInt(vals[col['Quantity']], 10); return isNaN(q) ? 1 : q; })(),
      (vals[col['ManaBox ID']]        || '').trim(),
      (vals[col['Scryfall ID']]       || '').trim(),
      parseFloat(vals[col['Purchase price']] || '0') || 0,
      (vals[col['Condition']]         || '').trim(),
      (vals[col['Language']]          || '').trim(),
      (vals[col['Purchase price currency']] || '').trim(),
      sourceFile,
    ]);

    // Insert when batch is full
    if (batchRows.length >= BATCH_SIZE) {
      totalInserted += insertBatch(batchRows);
      batchRows = [];
    }
  }

  // Insert remaining rows
  if (batchRows.length > 0) {
    totalInserted += insertBatch(batchRows);
  }

  const totalRows = lines.length - 1; // Subtract header
  return { inserted: totalInserted, skipped: totalRows - totalInserted };
}

/** Comma-delimited RFC-4180 line parser (ManaBox uses commas, not semicolons). */
const parseCSVLine = line => parseDelimitedLine(line, ',');

module.exports = { importInventoryFile, parseCSVLine };
