/**
 * Sales repository — all SQL queries for the Sold Orders dashboard.
 *
 * Functions receive a `db` instance so they are independently testable
 * without Electron (or anything in ipcMain) being present.
 */
'use strict';

const { sanitizeDate } = require('../parser');

/**
 * Compute the previous period of equal length for trend arrows.
 * @param {string|null} dateFrom
 * @param {string|null} dateTo
 * @returns {{ prevFrom: string|null, prevTo: string|null }}
 */
function prevPeriodDates(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) { return { prevFrom: null, prevTo: null }; }
  const from       = new Date(dateFrom);
  const to         = new Date(dateTo + 'T23:59:59');
  const durationMs = to.getTime() - from.getTime();
  const prevTo     = new Date(from.getTime() - 1);
  const prevFrom   = new Date(from.getTime() - durationMs);
  return {
    prevFrom: prevFrom.toISOString().split('T')[0],
    prevTo:   prevTo.toISOString().split('T')[0],
  };
}

/**
 * Detect calendar months between first and last order that have no data.
 * @param {import('better-sqlite3').Database} db
 * @param {'orders'|'purchases'} table
 * @returns {string[]}  e.g. ['2024-03', '2024-05']
 */
function detectMissingMonths(db, table = 'orders') {
  const rows = db.prepare(
    `SELECT DISTINCT substr(date_of_purchase, 1, 7) AS month FROM ${table} ORDER BY month`
  ).all().map(r => r.month);
  if (rows.length < 2) { return []; }
  const missing = [];
  let [y, m] = rows[0].split('-').map(Number);
  const [ey, em] = rows[rows.length - 1].split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (!rows.includes(key)) { missing.push(key); }
    if (++m > 12) { m = 1; y++; }
  }
  return missing;
}

/**
 * Return all data required for the Sales dashboard.
 * @param {import('better-sqlite3').Database} db
 * @param {{ dateFrom?: string, dateTo?: string }} filters
 */
function getSalesStats(db, filters = {}) {
  const dateFrom  = sanitizeDate(filters.dateFrom) ?? null;
  const dateTo    = sanitizeDate(filters.dateTo)   ?? null;
  const dateToEnd = dateTo ? dateTo + ' 23:59:59'  : null;

  const summary = db.prepare(`
    SELECT
      COUNT(*)                  AS total_orders,
      COUNT(DISTINCT username)  AS unique_buyers,
      SUM(article_count)        AS total_articles,
      SUM(merchandise_value)    AS total_revenue,
      SUM(total_value)          AS total_collected,
      SUM(commission)           AS total_commission,
      SUM(shipment_costs)       AS total_shipping,
      AVG(merchandise_value)    AS avg_order_value
    FROM orders
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
  `).get(dateFrom, dateToEnd);

  const { prevFrom, prevTo } = prevPeriodDates(dateFrom, dateTo);
  const prevSummary = (prevFrom && prevTo) ? db.prepare(`
    SELECT COUNT(*) AS total_orders, SUM(merchandise_value) AS total_revenue,
           SUM(commission) AS total_commission, SUM(shipment_costs) AS total_shipping,
           SUM(article_count) AS total_articles
    FROM orders WHERE date_of_purchase BETWEEN ? AND ?
  `).get(prevFrom, prevTo + ' 23:59:59') : null;

  const revenueByDay = db.prepare(`
    SELECT substr(date_of_purchase, 1, 10) AS day,
           SUM(merchandise_value) AS revenue, COUNT(*) AS orders
    FROM orders
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY day ORDER BY day
  `).all(dateFrom, dateToEnd);

  const revenueByCountry = db.prepare(`
    SELECT country, COUNT(*) AS orders, SUM(merchandise_value) AS revenue
    FROM orders
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY country ORDER BY revenue DESC LIMIT 15
  `).all(dateFrom, dateToEnd);

  const topCards = db.prepare(`
    SELECT i.card_name, i.set_name, i.rarity,
           SUM(i.quantity) AS qty_sold,
           SUM(i.price * i.quantity) AS revenue,
           SUM(i.price * i.quantity) - SUM(i.price * i.quantity * COALESCE(
             (SELECT commission / NULLIF(merchandise_value,0) FROM orders WHERE order_id = i.order_id), 0
           )) AS net_revenue,
           COUNT(DISTINCT i.order_id) AS in_orders
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
    GROUP BY i.card_name, i.set_name, i.rarity
    ORDER BY revenue DESC
  `).all(dateFrom, dateToEnd);

  const byRarity = db.prepare(`
    SELECT i.rarity, SUM(i.quantity) AS qty, SUM(i.price * i.quantity) AS revenue
    FROM order_items i JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
      AND i.rarity != ''
    GROUP BY i.rarity ORDER BY revenue DESC
  `).all(dateFrom, dateToEnd);

  const foilVsNormal = db.prepare(`
    SELECT is_foil, SUM(quantity) AS qty, SUM(price * quantity) AS revenue
    FROM order_items i JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
    GROUP BY is_foil
  `).all(dateFrom, dateToEnd);

  const byLanguage = db.prepare(`
    SELECT i.language, SUM(i.quantity) AS qty, SUM(i.price * i.quantity) AS revenue
    FROM order_items i JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
      AND i.language != ''
    GROUP BY i.language ORDER BY revenue DESC LIMIT 10
  `).all(dateFrom, dateToEnd);

  const bySet = db.prepare(`
    SELECT i.set_name, SUM(i.quantity) AS qty, SUM(i.price * i.quantity) AS revenue
    FROM order_items i JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
      AND i.set_name != ''
    GROUP BY i.set_name ORDER BY revenue DESC LIMIT 15
  `).all(dateFrom, dateToEnd);

  const byCondition = db.prepare(`
    SELECT i.condition, SUM(i.quantity) AS qty, SUM(i.price * i.quantity) AS revenue
    FROM order_items i JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
      AND i.condition != ''
    GROUP BY i.condition ORDER BY qty DESC
  `).all(dateFrom, dateToEnd);

  const allOrders = db.prepare(`
    SELECT order_id, username, buyer_name, country, is_professional, date_of_purchase,
           article_count, merchandise_value, shipment_costs, total_value, commission
    FROM orders
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    ORDER BY date_of_purchase DESC
  `).all(dateFrom, dateToEnd);

  const profitByMonth = db.prepare(`
    SELECT substr(date_of_purchase, 1, 7) AS month,
           SUM(merchandise_value) AS revenue,
           SUM(commission) AS commission,
           COUNT(*) AS orders, SUM(article_count) AS articles
    FROM orders
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
    GROUP BY month ORDER BY month
  `).all(dateFrom, dateToEnd);

  return {
    summary, prevSummary, revenueByDay, revenueByCountry,
    topCards, byRarity, foilVsNormal, byLanguage, bySet,
    byCondition, allOrders, profitByMonth,
    missingMonths: detectMissingMonths(db, 'orders'),
  };
}

module.exports = { getSalesStats, detectMissingMonths, prevPeriodDates };
