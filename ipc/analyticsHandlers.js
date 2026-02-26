/**
 * IPC handlers for analytics queries and the price-guide download.
 */
'use strict';

const { ipcMain, app } = require('electron');
const path = require('path');
const CH   = require('../lib/ipcChannels');
const { getSalesStats }   = require('../lib/repositories/salesRepo');
const { getPurchaseStats } = require('../lib/repositories/purchasesRepo');
const {
  computeProfitLoss, computeInventory, computeRepeatBuyers,
  computeSetROI, computeFoilPremium, computeTimeToSell,
} = require('../lib/analytics');
const { sanitizeDate } = require('../lib/parser');
const {
  downloadPriceGuide,
  loadPriceGuideIntoCache,
  enrichInventoryWithMarketPrices,
} = require('../lib/priceGuide');

/**
 * @param {object} ctx
 * @param {import('better-sqlite3').Database}               ctx.db
 * @param {import('../lib/settingsStore').SettingsStore}    ctx.settings
 * @param {Map<number, object>}                             ctx.priceGuideCache
 * @param {{ path: string }}                                ctx.priceGuide
 *   Mutable object — priceGuide.path is set after app.whenReady.
 */
function register(ctx) {
  const { db, settings, priceGuideCache, priceGuide } = ctx;

  // ─── Prepared statements (compiled once, reused on every call) ────────────
  const stmtSoldItems   = db.prepare(`
    SELECT i.card_name, i.set_name, i.rarity, i.quantity, i.price, i.is_foil,
           o.date_of_purchase AS date_of_sale
    FROM order_items i
    JOIN orders o ON o.order_id = i.order_id
    WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
      AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
  `);
  const stmtBoughtItems = db.prepare(`
    SELECT i.card_name, i.set_name, i.rarity, i.quantity, i.price, i.is_foil,
           p.date_of_purchase
    FROM purchase_items i
    JOIN purchases p ON p.order_id = i.order_id
    WHERE p.date_of_purchase >= COALESCE(?, p.date_of_purchase)
      AND p.date_of_purchase <= COALESCE(?, p.date_of_purchase)
  `);
  const stmtAllOrders   = db.prepare(`
    SELECT username, buyer_name, merchandise_value, article_count
    FROM orders
    WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
      AND date_of_purchase <= COALESCE(?, date_of_purchase)
  `);
  const stmtAllSold     = db.prepare(`
    SELECT i.card_name, i.set_name, i.quantity, i.price, i.is_foil, i.rarity,
           o.date_of_purchase AS date_of_sale
    FROM order_items i JOIN orders o ON o.order_id = i.order_id
  `);
  const stmtAllBought   = db.prepare(`
    SELECT i.card_name, i.set_name, i.quantity, i.price, i.is_foil, i.rarity,
           i.product_id, p.date_of_purchase
    FROM purchase_items i JOIN purchases p ON p.order_id = i.order_id
  `);

  // ─── Sales dashboard ───────────────────────────────────────────────────────
  ipcMain.handle(CH.GET_STATS, async (_, filters) => {
    const stats = getSalesStats(db, filters || {});
    stats.repeatBuyers = computeRepeatBuyers(stats.allOrders || []);
    return stats;
  });

  // ─── Purchases dashboard ───────────────────────────────────────────────────
  ipcMain.handle(CH.GET_PURCHASE_STATS, async (_, filters) => {
    return getPurchaseStats(db, filters || {});
  });

  // ─── Analytics (P&L, inventory, repeat buyers, set ROI, foil premium, time to sell) ──
  ipcMain.handle(CH.GET_ANALYTICS, async (_, filters) => {
    const dateFrom  = sanitizeDate(filters?.dateFrom) ?? null;
    const dateTo    = sanitizeDate(filters?.dateTo)   ?? null;
    const dateToEnd = dateTo ? dateTo + ' 23:59:59'   : null;
    const inventoryPage = Math.max(1, parseInt(filters?.inventoryPage || 1, 10));
    const inventoryPageSize = 1000; // Paginate by 1000 items per page

    const soldItems      = stmtSoldItems.all(dateFrom, dateToEnd);
    const boughtItems    = stmtBoughtItems.all(dateFrom, dateToEnd);
    const allOrders      = stmtAllOrders.all(dateFrom, dateToEnd);
    // For inventory: use date-filtered data when available, fallback to full history
    const allSoldItems   = dateToEnd ? stmtSoldItems.all(dateFrom, dateToEnd) : stmtAllSold.all();
    const allBoughtItems = dateToEnd ? stmtBoughtItems.all(dateFrom, dateToEnd) : stmtAllBought.all();

    const allInventoryItems = enrichInventoryWithMarketPrices(
      computeInventory(allBoughtItems, allSoldItems), priceGuideCache
    );
    const inventoryTotalValue = allInventoryItems.reduce((s, r) => s + (r.estimated_value || 0), 0);
    const inventoryTotalOnHand = allInventoryItems.reduce((s, r) => s + (r.qty_on_hand || 0), 0);
    const inventoryTotalMarketValue = allInventoryItems.reduce((s, r) => s + (r.market_value || 0), 0);
    
    // Paginate inventory for large datasets (1000 items per page)
    const inventoryStart = (inventoryPage - 1) * inventoryPageSize;
    const inventoryItems = allInventoryItems.slice(inventoryStart, inventoryStart + inventoryPageSize);
    const inventoryPageCount = Math.ceil(allInventoryItems.length / inventoryPageSize);

    // Revenue vs cost by month for the bar chart
    const rvcMap = new Map();
    for (const item of soldItems) {
      const month = (item.date_of_sale || '').slice(0, 7);
      if (!month) { continue; }
      if (!rvcMap.has(month)) { rvcMap.set(month, { month, revenue: 0, cost: 0 }); }
      rvcMap.get(month).revenue += (item.price || 0) * (item.quantity || 1);
    }
    for (const item of boughtItems) {
      const month = (item.date_of_purchase || '').slice(0, 7);
      if (!month) { continue; }
      if (!rvcMap.has(month)) { rvcMap.set(month, { month, revenue: 0, cost: 0 }); }
      rvcMap.get(month).cost += (item.price || 0) * (item.quantity || 1);
    }
    const revenueVsCostByMonth = [...rvcMap.values()].sort((a, b) => a.month.localeCompare(b.month));

    return {
      pnl:                 computeProfitLoss(soldItems, boughtItems),
      inventory: {
        items:              inventoryItems,
        page:               inventoryPage,
        pageSize:           inventoryPageSize,
        pageCount:          inventoryPageCount,
        totalCount:         allInventoryItems.length,
        totalValue:         inventoryTotalValue,
        totalOnHand:        inventoryTotalOnHand,
        totalMarketValue:   inventoryTotalMarketValue,
      },
      repeatBuyers:        computeRepeatBuyers(allOrders),
      setROI:              computeSetROI(allSoldItems, allBoughtItems),
      foilPremium:         computeFoilPremium(soldItems),
      timeToSell:          computeTimeToSell(allBoughtItems, allSoldItems),
      revenueVsCostByMonth,
    };
  });

  // ─── Price guide download ──────────────────────────────────────────────────
  ipcMain.handle(CH.DOWNLOAD_PRICE_GUIDE, async () => {
    if (!priceGuide.path) {
      priceGuide.path = path.join(app.getPath('userData'), 'price_guide.json');
    }
    try {
      const { count, createdAt } = await downloadPriceGuide(priceGuide.path);
      loadPriceGuideIntoCache(priceGuide.path, priceGuideCache);
      settings.set('price_guide_updated_at', createdAt);
      return { ok: true, count, updatedAt: createdAt };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

module.exports = { register };
