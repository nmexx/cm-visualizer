'use strict';

const fs   = require('fs');
const path = require('path');
const { parseFloat_eu, parseDescriptionItem, parseCSVLine } = require('./parser');

/**
 * Import a single Cardmarket CSV file into the provided better-sqlite3 database.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} filePath
 * @returns {{ inserted: number, replaced: number }}
 */
function importCSVFile(db, filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines   = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {return { inserted: 0, replaced: 0 };}

  // Skip header row
  const dataLines = lines.slice(1);

  const insertOrder = db.prepare(`
    INSERT OR REPLACE INTO orders
      (order_id, username, buyer_name, city, country, is_professional, date_of_purchase,
       article_count, merchandise_value, shipment_costs, total_value, commission, currency, source_file)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO order_items
      (order_id, product_id, card_name, localized_name, set_name, collector_num,
       rarity, condition, language, is_foil, quantity, price)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const deleteItems = db.prepare(`DELETE FROM order_items WHERE order_id = ?`);
  const orderExists = db.prepare(`SELECT order_id FROM orders WHERE order_id = ?`);

  let inserted = 0;
  let replaced = 0;

  const importAll = db.transaction(() => {
    for (const line of dataLines) {
      if (!line.trim()) {continue;}
      try {
      const cols = parseCSVLine(line);

      // Column indices (0-based):
      // 0:OrderID  1:Username  2:Name  3:Street  4:City  5:Country  6:IsPro  7:VAT
      // 8:DateOfPurchase  9:ArticleCount  10:MerchandiseValue  11:ShipmentCosts
      // 12:TotalValue  13:Commission  14:Currency  15:Description  16:ProductID  17:LocalizedName
      const order_id = cols[0]?.trim();
      if (!order_id) {continue;}

      const existing = orderExists.get(order_id);
      if (existing) {
        deleteItems.run(order_id);
        replaced++;
      }

      insertOrder.run(
        order_id,
        cols[1]?.trim(),
        cols[2]?.trim(),
        cols[4]?.trim(),
        cols[5]?.trim(),
        cols[6]?.trim() ? 1 : 0,
        cols[8]?.trim(),
        parseInt(cols[9], 10) || 0,
        parseFloat_eu(cols[10]),
        parseFloat_eu(cols[11]),
        parseFloat_eu(cols[12]),
        parseFloat_eu(cols[13]),
        cols[14]?.trim() || 'EUR',
        path.basename(filePath)
      );

      const description = cols[15] || '';
      const productIDs  = (cols[16] || '').split('|').map(s => s.trim());
      const localNames  = (cols[17] || '').split('|').map(s => s.trim());
      const items       = description.split('|');

      items.forEach((rawItem, idx) => {
        const parsed = parseDescriptionItem(rawItem);
        insertItem.run(
          order_id,
          productIDs[idx] || '',
          parsed.card_name,
          localNames[idx]  || '',
          parsed.set_name,
          parsed.collector_num,
          parsed.rarity,
          parsed.condition,
          parsed.language,
          parsed.is_foil,
          parsed.quantity,
          parsed.price
        );
      });

      if (!existing) {inserted++;}
      } catch (e) {
        console.warn(`[importer] skipping malformed row: ${e.message}`);
      }
    }
  });

  importAll();
  return { inserted, replaced };
}

module.exports = { importCSVFile };
