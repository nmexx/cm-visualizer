'use strict';

/**
 * Parse a European-formatted float string.
 *
 * Handles both plain decimals ("3,98" → 3.98) and values with a dot-thousands
 * separator ("1.234,56" → 1234.56). When no comma is present the string is
 * treated as a standard dot-decimal float ("3.98" → 3.98).
 *
 * @param {string} str
 * @returns {number}
 */
function parseFloat_eu(str) {
  if (!str) { return 0; }
  const s = String(str).trim();
  if (s.includes(',')) {
    // EU format: dots are thousands separators, comma is the decimal mark
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return parseFloat(s) || 0;
}

/**
 * Parse a single pipe-separated Description entry from a Cardmarket CSV row.
 *
 * Examples
 *   "1x Torpor Orb (Mystery Booster 2) - 236 - Rare - NM - English - 3,98 EUR"
 *   "1x Glasswing Grace // Age-Graced Chapel (Modern Horizons 3) - 254 - Uncommon - NM - English - Foil - 0,31 EUR"
 *   "1x Polluted Bonds (V.2) (Enchanting Tales) - 75 - Rare - NM - English - Foil - 8,00 EUR"
 *
 * @param {string} raw  One pipe-delimited item (NOT the full Description column)
 * @returns {{ quantity: number, price: number, is_foil: 0|1,
 *             language: string, condition: string, rarity: string,
 *             collector_num: string, set_name: string, card_name: string }}
 */
function parseDescriptionItem(raw) {
  raw = raw.trim();

  // Extract quantity
  const qtyMatch = raw.match(/^(\d+)x\s+/);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  raw = raw.replace(/^\d+x\s+/, '');

  // Extract price at the end  (e.g. "- 3,98 EUR" or " 3.98 EUR")
  const priceMatch = raw.match(/[\s-]+(\d+[,.]\d+)\s+EUR\s*$/);
  const price = priceMatch ? parseFloat_eu(priceMatch[1]) : 0;
  raw = raw.replace(/[\s-]+\d+[,.]\d+\s+EUR\s*$/, '');

  // Check foil flag
  const is_foil = /\bFoil\b/i.test(raw) ? 1 : 0;
  raw = raw.replace(/\s*-\s*Foil\s*/i, '');

  // Split remaining parts on " - " separator
  const parts = raw.split(/\s+-\s+/);
  const language      = parts.length >= 1 ? parts[parts.length - 1].trim() : '';
  const condition     = parts.length >= 2 ? parts[parts.length - 2].trim() : '';
  const rarity        = parts.length >= 3 ? parts[parts.length - 3].trim() : '';
  const collector_num = parts.length >= 4 ? parts[parts.length - 4].trim() : '';

  // Card name + set: "Card Name (Set Name)" OR "Card Name (V.2) (Set Name)"
  const fullNamePart = parts[0] ? parts[0].trim() : raw;

  // Set = last parenthetical group
  const setMatch = fullNamePart.match(/\(([^)]+)\)\s*$/);
  const set_name  = setMatch ? setMatch[1] : '';
  const card_name = fullNamePart.replace(/\s*\([^)]+\)\s*$/, '').trim();

  return { quantity, price, is_foil, language, condition, rarity, collector_num, set_name, card_name };
}

/**
 * RFC-4180 parser for a single delimited line.
 * Handles double-quoted fields, including fields that contain the delimiter or
 * escaped double-quotes ("").
 * @param {string} line
 * @param {string} sep - single-character delimiter (default ',')
 * @returns {string[]}
 */
function parseDelimitedLine(line, sep = ',') {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === sep && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/**
 * Split a single Cardmarket CSV line into its columns.
 * Cardmarket fields are semicolon-delimited and are never quoted, so a plain
 * split is used rather than the full RFC-4180 parseDelimitedLine path.
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  return line.split(';');
}

/**
 * Validate and sanitise a date string to prevent SQL injection.
 * Only accepts the strict ISO format YYYY-MM-DD.
 * @param {string|undefined} str
 * @returns {string|null}
 */
function sanitizeDate(str) {
  if (!str || typeof str !== 'string') {return null;}
  return /^\d{4}-\d{2}-\d{2}$/.test(str.trim()) ? str.trim() : null;
}

module.exports = { parseFloat_eu, parseDescriptionItem, parseCSVLine, parseDelimitedLine, sanitizeDate };
