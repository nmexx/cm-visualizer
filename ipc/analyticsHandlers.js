/**
 * IPC handlers for analytics queries and the price-guide download.
 */
'use strict';

const { ipcMain } = require('electron');
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

  // ─── Sales dashboard ───────────────────────────────────────────────────────
  ipcMain.handle(CH.GET_STATS, async (_, filters) => {
    return getSalesStats(db, filters || {});
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

    const soldItems = db.prepare(`
      SELECT i.card_name, i.set_name, i.rarity, i.quantity, i.price, i.is_foil
      FROM order_items i
      JOIN orders o ON o.order_id = i.order_id
      WHERE o.date_of_purchase >= COALESCE(?, o.date_of_purchase)
        AND o.date_of_purchase <= COALESCE(?, o.date_of_purchase)
    `).all(dateFrom, dateToEnd);

    const boughtItems = db.prepare(`
      SELECT i.card_name, i.set_name, i.rarity, i.quantity, i.price, i.is_foil
      FROM purchase_items i
      JOIN purchases p ON p.order_id = i.order_id
      WHERE p.date_of_purchase >= COALESCE(?, p.date_of_purchase)
        AND p.date_of_purchase <= COALESCE(?, p.date_of_purchase)
    `).all(dateFrom, dateToEnd);

    const allOrders = db.prepare(`
      SELECT username, buyer_name, merchandise_value, article_count
      FROM orders
      WHERE date_of_purchase >= COALESCE(?, date_of_purchase)
        AND date_of_purchase <= COALESCE(?, date_of_purchase)
    `).all(dateFrom, dateToEnd);

    // Always use full history for inventory / time-to-sell
    const allSoldItems = db.prepare(`
      SELECT i.card_name, i.set_name, i.quantity, i.price, i.is_foil, i.rarity,
             o.date_of_purchase AS date_of_sale
      FROM order_items i JOIN orders o ON o.order_id = i.order_id
    `).all();

    const allBoughtItems = db.prepare(`
      SELECT i.card_name, i.set_name, i.quantity, i.price, i.is_foil, i.rarity,
             i.product_id, p.date_of_purchase
      FROM purchase_items i JOIN purchases p ON p.order_id = i.order_id
    `).all();

    return {
      profitLoss:   computeProfitLoss(soldItems, boughtItems),
      inventory:    enrichInventoryWithMarketPrices(computeInventory(allBoughtItems, allSoldItems), priceGuideCache),
      repeatBuyers: computeRepeatBuyers(allOrders),
      setROI:       computeSetROI(allSoldItems, allBoughtItems),
      foilPremium:  computeFoilPremium(soldItems),
      timeToSell:   computeTimeToSell(allBoughtItems, allSoldItems),
    };
  });

  // ─── Price guide download ──────────────────────────────────────────────────
  ipcMain.handle(CH.DOWNLOAD_PRICE_GUIDE, async () => {
    if (!priceGuide.path) {
      priceGuide.path = path.join(require('electron').app.getPath('userData'), 'price_guide.json');
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
