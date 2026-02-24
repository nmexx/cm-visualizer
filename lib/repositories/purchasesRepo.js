/**
 * Purchases repository — all SQL queries for the Purchased Orders dashboard.
 */
'use strict';

const { sanitizeDate } = require('../parser');
const { detectMissingMonths } = require('./salesRepo');

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
    SELECT COUNT(*) AS total_orders, COUNT(DISTINCT seller_username) AS unique_sellers,
           SUM(article_count) AS total_articles, SUM(merchandise_value) AS total_spent,
           SUM(total_value) AS total_paid, SUM(shipment_costs) AS total_shipping,
           SUM(trustee_fee) AS total_fees, AVG(merchandise_value) AS avg_order_value
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
  `).get(dateFrom, dateToEnd);

  const spendByDay = db.prepare(`
    SELECT substr(date_of_purchase, 1, 10) AS day,
           SUM(merchandise_value) AS spent, COUNT(*) AS orders
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY day ORDER BY day
  `).all(dateFrom, dateToEnd);

  const spendByMonth = db.prepare(`
    SELECT substr(date_of_purchase, 1, 7) AS month,
           SUM(merchandise_value) AS spent, SUM(trustee_fee) AS fees, COUNT(*) AS orders
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY month ORDER BY month
  `).all(dateFrom, dateToEnd);

  const topSellers = db.prepare(`
    SELECT seller_username, seller_name, country, is_professional,
           COUNT(*) AS orders, SUM(merchandise_value) AS spent
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY seller_username ORDER BY spent DESC LIMIT 15
  `).all(dateFrom, dateToEnd);

  const topBoughtCards = db.prepare(`
    SELECT i.card_name, i.set_name, i.rarity,
           SUM(i.quantity) AS qty_bought, SUM(i.price * i.quantity) AS spent,
           COUNT(DISTINCT i.order_id) AS in_orders
    FROM purchase_items i
    JOIN purchases p ON p.order_id = i.order_id
    WHERE p.date_of_purchase >= COALESCE(?, p.date_of_purchase)
      AND p.date_of_purchase <= COALESCE(?, p.date_of_purchase)
    GROUP BY i.card_name, i.set_name, i.rarity
    ORDER BY spent DESC LIMIT 20
  `).all(dateFrom, dateToEnd);

  const byRarity = db.prepare(`
    SELECT i.rarity, SUM(i.quantity) AS qty, SUM(i.price * i.quantity) AS spent
    FROM purchase_items i JOIN purchases p ON p.order_id = i.order_id
    WHERE p.date_of_purchase >= COALESCE(?, p.date_of_purchase)
      AND p.date_of_purchase <= COALESCE(?, p.date_of_purchase)
      AND i.rarity != ''
    GROUP BY i.rarity ORDER BY spent DESC
  `).all(dateFrom, dateToEnd);

  const byCountry = db.prepare(`
    SELECT country, COUNT(*) AS orders, SUM(merchandise_value) AS spent
    FROM purchases
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY country ORDER BY spent DESC LIMIT 10
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
    summary, spendByDay, spendByMonth, topSellers,
    topBoughtCards, byRarity, byCountry, allPurchases,
    missingMonths: detectMissingMonths(db, 'purchases'),
  };
}

module.exports = { getPurchaseStats };
