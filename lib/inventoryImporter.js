'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Parse a ManaBox-style inventory CSV and upsert rows into manabox_inventory.
 *
 * Expected CSV columns (comma-separated, may be quoted):
 *   Name, Set code, Set name, Collector number, Foil, Rarity, Quantity,
 *   ManaBox ID, Scryfall ID, Purchase price, Misprint, Altered,
 *   Condition, Language, Purchase price currency
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

  const insertMany = db.transaction((rows) => {
    let inserted = 0;
    for (const row of rows) {
      const info = stmt.run(...row);
      if (info && info.changes > 0) {inserted++;}
    }
    return inserted;
  });

  const sourceFile = path.basename(filePath);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const name = vals[col['Name']];
    if (!name || !name.trim()) {continue;}

    rows.push([
      name.trim(),
      (vals[col['Set code']]          || '').trim(),
      (vals[col['Set name']]          || '').trim(),
      (vals[col['Collector number']]  || '').trim(),
      (vals[col['Foil']]              || '').trim().toLowerCase() === 'foil' ? 1 : 0,
      (vals[col['Rarity']]            || '').trim(),
      parseInt(vals[col['Quantity']]  || '1', 10) || 1,
      (vals[col['ManaBox ID']]        || '').trim(),
      (vals[col['Scryfall ID']]       || '').trim(),
      parseFloat(vals[col['Purchase price']] || '0') || 0,
      (vals[col['Condition']]         || '').trim(),
      (vals[col['Language']]          || '').trim(),
      (vals[col['Purchase price currency']] || '').trim(),
      sourceFile,
    ]);
  }

  const inserted = insertMany(rows);
  return { inserted, skipped: rows.length - inserted };
}

/**
 * Minimal CSV line parser that handles RFC-4180 double-quoted fields
 * (including fields containing commas or quoted quote characters).
 *
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const result = [];
  let cur     = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

module.exports = { importInventoryFile, parseCSVLine };
