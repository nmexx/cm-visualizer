/**
 * Purchases repository — all SQL queries for the Purchased Orders dashboard.
 */
'use strict';

const { sanitizeDate } = require('../parser');
const { detectMissingMonths, prevPeriodDates } = require('./salesRepo');

/**
 * Return all data required for the Purchases dashboard.
 * @param {import('better-sqlite3').Database} db
 * @param {{ dateFrom?: string, dateTo?: string }} filters
 */
function getPurchaseStats(db, filters = {}) {
  const dateFrom  = sanitizeDate(filters.dateFrom) ?? null;
  const dateTo    = sanitizeDate(filters.dateTo)   ?? null;
  const dateToEnd = dateTo ? dateTo + ' 23:59:59'  : null;

  const summary = db.prepare(`
    SELECT COUNT(*) AS total_purchases,
           COUNT(DISTINCT seller_username) AS unique_sellers,
           SUM(article_count) AS total_cards,
           SUM(merchandise_value) AS total_spent,
           SUM(total_value) AS total_paid,
           SUM(shipment_costs) AS total_shipping,
           SUM(trustee_fee) AS total_fees,
           AVG(merchandise_value) AS avg_purchase_value
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
  `).get(dateFrom, dateToEnd);

  // Average per-card cost (price per item line, not per order)
  const cardCostRow = db.prepare(`
    SELECT AVG(i.price) AS avg_card_cost
    FROM purchase_items i
    JOIN purchases p ON p.order_id = i.order_id
    WHERE p.date_of_purchase >= COALESCE(?, p.date_of_purchase)
      AND p.date_of_purchase <= COALESCE(?, p.date_of_purchase)
  `).get(dateFrom, dateToEnd);
  if (summary) summary.avg_card_cost = cardCostRow?.avg_card_cost ?? null;

  // Previous-period summary for trend arrows
  const { prevFrom, prevTo } = prevPeriodDates(dateFrom, dateTo);
  const prevEnd = prevTo ? prevTo + ' 23:59:59' : null;
  const prevSummary = (prevFrom && prevTo) ? db.prepare(`
    SELECT COUNT(*) AS total_purchases,
           SUM(article_count) AS total_cards,
           SUM(merchandise_value) AS total_spent
    FROM purchases
    WHERE date_of_purchase >= ? AND date_of_purchase <= ?
  `).get(prevFrom, prevEnd) : null;

  const spendByDay = db.prepare(`
    SELECT substr(date_of_purchase, 1, 10) AS day,
           SUM(merchandise_value) AS amount_spent, COUNT(*) AS orders
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY day ORDER BY day
  `).all(dateFrom, dateToEnd);

  const spendByMonth = db.prepare(`
    SELECT substr(date_of_purchase, 1, 7) AS month,
           SUM(merchandise_value) AS amount_spent,
           SUM(trustee_fee) AS fees, COUNT(*) AS orders
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY month ORDER BY month
  `).all(dateFrom, dateToEnd);

  const bySeller = db.prepare(`
    SELECT seller_username, seller_name, country, is_professional,
           COUNT(*) AS orders, SUM(merchandise_value) AS amount_spent
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY seller_username ORDER BY amount_spent DESC LIMIT 15
  `).all(dateFrom, dateToEnd);

  const topBoughtCards = db.prepare(`
    SELECT i.card_name, i.set_name, i.rarity,
           SUM(i.quantity) AS qty_bought, SUM(i.price * i.quantity) AS spent,
           COUNT(DISTINCT i.order_id) AS in_orders,
           MIN(p.date_of_purchase) AS first_purchase,
           MAX(p.date_of_purchase) AS last_purchase
    FROM purchase_items i
    JOIN purchases p ON p.order_id = i.order_id
    WHERE p.date_of_purchase >= COALESCE(?, p.date_of_purchase)
      AND p.date_of_purchase <= COALESCE(?, p.date_of_purchase)
    GROUP BY i.card_name, i.set_name, i.rarity
    ORDER BY spent DESC
  `).all(dateFrom, dateToEnd);

  const byRarity = db.prepare(`
    SELECT i.rarity, SUM(i.quantity) AS qty, SUM(i.price * i.quantity) AS amount_spent
    FROM purchase_items i JOIN purchases p ON p.order_id = i.order_id
    WHERE p.date_of_purchase >= COALESCE(?, p.date_of_purchase)
      AND p.date_of_purchase <= COALESCE(?, p.date_of_purchase)
      AND i.rarity != ''
    GROUP BY i.rarity ORDER BY amount_spent DESC
  `).all(dateFrom, dateToEnd);

  const foilVsNormal = db.prepare(`
    SELECT i.is_foil, SUM(i.quantity) AS qty, SUM(i.price * i.quantity) AS amount_spent
    FROM purchase_items i
    JOIN purchases p ON p.order_id = i.order_id
    WHERE p.date_of_purchase >= COALESCE(?, p.date_of_purchase)
      AND p.date_of_purchase <= COALESCE(?, p.date_of_purchase)
    GROUP BY i.is_foil
  `).all(dateFrom, dateToEnd);

  const byCountry = db.prepare(`
    SELECT country, COUNT(*) AS orders, SUM(merchandise_value) AS amount_spent
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY country ORDER BY amount_spent DESC LIMIT 10
  `).all(dateFrom, dateToEnd);

  const allPurchases = db.prepare(`
    SELECT order_id, seller_username, seller_name, country, is_professional,
           date_of_purchase, article_count, merchandise_value, total_value, trustee_fee
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    ORDER BY date_of_purchase DESC
  `).all(dateFrom, dateToEnd);

  return {
    summary, prevSummary, spendByDay, spendByMonth, bySeller,
    foilVsNormal, topBoughtCards, byRarity, byCountry, allPurchases,
    missingMonths: detectMissingMonths(db, 'purchases'),
  };
}

module.exports = { getPurchaseStats };
