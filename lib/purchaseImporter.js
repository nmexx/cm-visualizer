'use strict';

const fs   = require('fs');
const path = require('path');
const { parseFloat_eu, parseDescriptionItem, parseCSVLine } = require('./parser');

/**
 * Import a single Cardmarket "Purchased Orders" CSV into the provided database.
 *
 * Purchased Orders CSV column layout (0-based):
 *   0:OrderID  1:Username(seller)  2:Name(seller)  3:Street  4:City  5:Country
 *   6:IsProfessional  7:VATNumber  8:DateOfPurchase  9:ArticleCount
 *   10:MerchandiseValue  11:ShipmentCosts  12:TrusteeServiceFee
 *   13:TotalValue  14:Currency  15:Description  16:ProductID  17:LocalizedName
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} filePath
 * @returns {{ inserted: number, replaced: number }}
 */
function importPurchasedCSVFile(db, filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines   = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {return { inserted: 0, replaced: 0 };}

  const dataLines = lines.slice(1);

  const insertPurchase = db.prepare(`
    INSERT OR REPLACE INTO purchases
      (order_id, seller_username, seller_name, city, country, is_professional,
       date_of_purchase, article_count, merchandise_value, shipment_costs,
       trustee_fee, total_value, currency, source_file)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO purchase_items
      (order_id, product_id, card_name, localized_name, set_name, collector_num,
       rarity, condition, language, is_foil, quantity, price)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const deleteItems   = db.prepare(`DELETE FROM purchase_items WHERE order_id = ?`);
  const orderExists   = db.prepare(`SELECT order_id FROM purchases WHERE order_id = ?`);

  let inserted = 0;
  let replaced = 0;

  const importAll = db.transaction(() => {
    for (const line of dataLines) {
      if (!line.trim()) {continue;}
      try {
        const cols = parseCSVLine(line);

        const order_id = cols[0]?.trim();
        if (!order_id) {continue;}

        const existing = orderExists.get(order_id);
        if (existing) {
          deleteItems.run(order_id);
          replaced++;
        }

        insertPurchase.run(
          order_id,
          cols[1]?.trim(),              // seller_username
          cols[2]?.trim(),              // seller_name
          cols[4]?.trim(),              // city
          cols[5]?.trim(),              // country
          cols[6]?.trim() ? 1 : 0,      // is_professional
          cols[8]?.trim(),              // date_of_purchase
          parseInt(cols[9], 10) || 0,   // article_count
          parseFloat_eu(cols[10]),      // merchandise_value
          parseFloat_eu(cols[11]),      // shipment_costs
          parseFloat_eu(cols[12]),      // trustee_fee
          parseFloat_eu(cols[13]),      // total_value
          cols[14]?.trim() || 'EUR',    // currency
          path.basename(filePath)       // source_file
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
      } catch (err) {
        console.warn('[purchaseImporter] skipping malformed row:', err.message);
      }
    }
  });

  importAll();
  return { inserted, replaced };
}

module.exports = { importPurchasedCSVFile };
