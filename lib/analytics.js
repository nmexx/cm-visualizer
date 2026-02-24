'use strict';

/**
 * Pure analytics functions — no DB dependency.
 * Each function takes pre-fetched arrays and returns computed results.
 * This design makes unit testing trivial without native DB bindings.
 */

// ─── P&L ─────────────────────────────────────────────────────────────────────

/**
 * Join sold items with bought items by card_name + set_name and compute profit.
 *
 * @param {Array} soldItems    - rows: { card_name, set_name, rarity, quantity, price }
 * @param {Array} boughtItems  - rows: { card_name, set_name, rarity, quantity, price }
 * @returns {Array} rows sorted by profit DESC
 */
function computeProfitLoss(soldItems, boughtItems) {
  const buyMap = new Map();
  for (const item of boughtItems) {
    const key = `${item.card_name}||${item.set_name}`;
    if (!buyMap.has(key)) {
      buyMap.set(key, {
        card_name: item.card_name, set_name: item.set_name, rarity: item.rarity,
        qty: 0, cost: 0,
      });
    }
    const b = buyMap.get(key);
    b.qty  += (item.quantity || 1);
    b.cost += (item.price || 0) * (item.quantity || 1);
  }

  const sellMap = new Map();
  for (const item of soldItems) {
    const key = `${item.card_name}||${item.set_name}`;
    if (!sellMap.has(key)) {
      sellMap.set(key, {
        card_name: item.card_name, set_name: item.set_name, rarity: item.rarity,
        qty: 0, revenue: 0,
      });
    }
    const s = sellMap.get(key);
    s.qty     += (item.quantity || 1);
    s.revenue += (item.price || 0) * (item.quantity || 1);
  }

  const results = [];
  for (const [key, sell] of sellMap) {
    const buy    = buyMap.get(key) || { qty: 0, cost: 0 };
    const profit = sell.revenue - buy.cost;
    const margin = buy.cost > 0 ? (profit / buy.cost * 100) : null;
    results.push({
      card_name:     sell.card_name,
      set_name:      sell.set_name,
      rarity:        sell.rarity || (buy.rarity || ''),
      qty_bought:    buy.qty,
      qty_sold:      sell.qty,
      total_cost:    buy.cost,
      total_revenue: sell.revenue,
      avg_buy:       buy.qty  > 0 ? buy.cost    / buy.qty  : 0,
      avg_sell:      sell.qty > 0 ? sell.revenue / sell.qty : 0,
      profit,
      margin_pct:    margin,
    });
  }
  results.sort((a, b) => b.profit - a.profit);
  return results;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

/**
 * Cards that have been bought but not fully sold (qty_on_hand > 0).
 *
 * @param {Array} boughtItems - rows: { card_name, set_name, rarity, quantity, price }
 * @param {Array} soldItems   - rows: { card_name, set_name, quantity }
 * @returns {Array} sorted by estimated_value DESC
 */
function computeInventory(boughtItems, soldItems) {
  const buyMap = new Map();
  for (const item of boughtItems) {
    const key = `${item.card_name}||${item.set_name}`;
    if (!buyMap.has(key)) {
      buyMap.set(key, {
        card_name: item.card_name, set_name: item.set_name, rarity: item.rarity,
        qty: 0, cost: 0,
      });
    }
    const b = buyMap.get(key);
    b.qty  += (item.quantity || 1);
    b.cost += (item.price || 0) * (item.quantity || 1);
  }

  const sellMap = new Map();
  for (const item of soldItems) {
    const key = `${item.card_name}||${item.set_name}`;
    sellMap.set(key, (sellMap.get(key) || 0) + (item.quantity || 1));
  }

  const results = [];
  for (const [key, b] of buyMap) {
    const qtySold   = sellMap.get(key) || 0;
    const qtyOnHand = b.qty - qtySold;
    if (qtyOnHand <= 0) { continue; }
    const avgBuy = b.qty > 0 ? b.cost / b.qty : 0;
    results.push({
      card_name:       b.card_name,
      set_name:        b.set_name,
      rarity:          b.rarity,
      qty_bought:      b.qty,
      qty_sold:        qtySold,
      qty_on_hand:     qtyOnHand,
      total_cost:      b.cost,
      avg_buy_price:   avgBuy,
      estimated_value: qtyOnHand * avgBuy,
    });
  }
  results.sort((a, b) => b.estimated_value - a.estimated_value);
  return results;
}

// ─── Repeat buyers ────────────────────────────────────────────────────────────

/**
 * Aggregate buyer stats and compute retention metrics.
 *
 * @param {Array} orders - rows: { username, buyer_name, merchandise_value, article_count }
 * @returns {{ total, repeatCount, repeatPct, repeatRevenuePct, topRepeats, distribution }}
 */
function computeRepeatBuyers(orders) {
  const buyerMap = new Map();
  for (const o of orders) {
    if (!buyerMap.has(o.username)) {
      buyerMap.set(o.username, {
        username: o.username, buyer_name: o.buyer_name,
        order_count: 0, total_revenue: 0, total_articles: 0,
      });
    }
    const b = buyerMap.get(o.username);
    b.order_count++;
    b.total_revenue  += o.merchandise_value || 0;
    b.total_articles += o.article_count     || 0;
  }

  const buyers        = [...buyerMap.values()];
  const total         = buyers.length;
  const repeats       = buyers.filter(b => b.order_count > 1);
  const totalRevenue  = buyers.reduce((s, b)  => s + b.total_revenue, 0);
  const repeatRevenue = repeats.reduce((s, b) => s + b.total_revenue, 0);

  repeats.sort((a, b) => b.order_count - a.order_count);

  return {
    total,
    repeatCount:       repeats.length,
    repeatPct:         total > 0 ? repeats.length / total * 100 : 0,
    repeatRevenuePct:  totalRevenue > 0 ? repeatRevenue / totalRevenue * 100 : 0,
    topRepeats:        repeats.slice(0, 20),
    distribution: {
      once:   buyers.filter(b => b.order_count === 1).length,
      twice:  buyers.filter(b => b.order_count === 2).length,
      thrice: buyers.filter(b => b.order_count === 3).length,
      more:   buyers.filter(b => b.order_count >= 4).length,
    },
  };
}

// ─── Set ROI ──────────────────────────────────────────────────────────────────

/**
 * Compare average buy price vs average sell price per set to compute ROI.
 *
 * @param {Array} soldItems   - rows: { set_name, quantity, price }
 * @param {Array} boughtItems - rows: { set_name, quantity, price }
 * @returns {Array} sorted by roi_pct DESC (nulls last)
 */
function computeSetROI(soldItems, boughtItems) {
  const buy = new Map();
  for (const i of boughtItems) {
    const key = i.set_name;
    if (!key) { continue; }
    if (!buy.has(key)) { buy.set(key, { qty: 0, cost: 0 }); }
    const b = buy.get(key);
    b.qty  += (i.quantity || 1);
    b.cost += (i.price || 0) * (i.quantity || 1);
  }

  const sell = new Map();
  for (const i of soldItems) {
    const key = i.set_name;
    if (!key) { continue; }
    if (!sell.has(key)) { sell.set(key, { qty: 0, revenue: 0 }); }
    const s = sell.get(key);
    s.qty     += (i.quantity || 1);
    s.revenue += (i.price || 0) * (i.quantity || 1);
  }

  const results = [];
  for (const [set_name, b] of buy) {
    const s       = sell.get(set_name) || { qty: 0, revenue: 0 };
    const avgBuy  = b.qty > 0 ? b.cost    / b.qty  : 0;
    const avgSell = s.qty > 0 ? s.revenue / s.qty  : 0;
    const roi_pct = avgBuy > 0 ? (avgSell - avgBuy) / avgBuy * 100 : null;
    results.push({
      set_name, qty_bought: b.qty, qty_sold: s.qty,
      total_cost: b.cost, total_revenue: s.revenue,
      avg_buy: avgBuy, avg_sell: avgSell, roi_pct,
    });
  }
  results.sort((a, b) => {
    if (a.roi_pct === null && b.roi_pct === null) { return 0; }
    if (a.roi_pct === null) { return 1; }
    if (b.roi_pct === null) { return -1; }
    return b.roi_pct - a.roi_pct;
  });
  return results;
}

// ─── Foil premium ─────────────────────────────────────────────────────────────

/**
 * Compute foil vs non-foil average price per card from sold items.
 * Only returns cards that have BOTH foil and non-foil sales.
 *
 * @param {Array} soldItems - rows: { card_name, set_name, rarity, is_foil, quantity, price }
 * @returns {Array} sorted by foil_premium_pct DESC, max 50 rows
 */
function computeFoilPremium(soldItems) {
  const map = new Map();
  for (const i of soldItems) {
    if (!i.card_name) { continue; }
    const key = `${i.card_name}||${i.set_name}`;
    if (!map.has(key)) {
      map.set(key, {
        card_name: i.card_name, set_name: i.set_name, rarity: i.rarity,
        foil_qty: 0, foil_total: 0, normal_qty: 0, normal_total: 0,
      });
    }
    const r = map.get(key);
    if (i.is_foil) {
      r.foil_qty   += (i.quantity || 1);
      r.foil_total += (i.price || 0) * (i.quantity || 1);
    } else {
      r.normal_qty   += (i.quantity || 1);
      r.normal_total += (i.price || 0) * (i.quantity || 1);
    }
  }

  const results = [];
  for (const [, r] of map) {
    if (r.foil_qty === 0 || r.normal_qty === 0) { continue; }
    const avgFoil   = r.foil_total   / r.foil_qty;
    const avgNormal = r.normal_total / r.normal_qty;
    const premium   = avgNormal > 0 ? (avgFoil - avgNormal) / avgNormal * 100 : null;
    results.push({
      card_name:        r.card_name,
      set_name:         r.set_name,
      rarity:           r.rarity,
      avg_foil_price:   avgFoil,
      avg_normal_price: avgNormal,
      qty_foil:         r.foil_qty,
      qty_normal:       r.normal_qty,
      foil_premium_pct: premium,
    });
  }
  results.sort((a, b) => (b.foil_premium_pct || 0) - (a.foil_premium_pct || 0));
  return results.slice(0, 50);
}

// ─── Time-to-sell ─────────────────────────────────────────────────────────────

/**
 * Compute the number of days between first purchase and first sale per card.
 * Only returns cards present in both purchase and sale data.
 *
 * @param {Array} purchaseItems - rows: { card_name, set_name, date_of_purchase }
 * @param {Array} saleItems     - rows: { card_name, set_name, date_of_sale }
 * @returns {Array} sorted by days_to_sell ASC
 */
function computeTimeToSell(purchaseItems, saleItems) {
  const firstBuy = new Map();
  for (const i of purchaseItems) {
    const key = `${i.card_name}||${i.set_name}`;
    const d = (i.date_of_purchase || '').substring(0, 10);
    const cur = firstBuy.get(key);
    if (!cur || d < cur) { firstBuy.set(key, d); }
  }

  const firstSell = new Map();
  for (const i of saleItems) {
    const key = `${i.card_name}||${i.set_name}`;
    const d = (i.date_of_sale || '').substring(0, 10);
    const cur = firstSell.get(key);
    if (!cur || d < cur) { firstSell.set(key, d); }
  }

  const results = [];
  for (const [key, buyDate] of firstBuy) {
    const sellDate = firstSell.get(key);
    if (!sellDate) { continue; }
    const ms   = new Date(sellDate) - new Date(buyDate);
    const days = Math.round(ms / 86400000);
    if (days < 0) { continue; }
    const [card_name, set_name] = key.split('||');
    results.push({ card_name, set_name, first_bought: buyDate, first_sold: sellDate, days_to_sell: days });
  }
  results.sort((a, b) => a.days_to_sell - b.days_to_sell);
  return results;
}

module.exports = {
  computeProfitLoss,
  computeInventory,
  computeRepeatBuyers,
  computeSetROI,
  computeFoilPremium,
  computeTimeToSell,
};
