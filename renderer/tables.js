/**
 * Per-table tbody render functions (pure DOM writes) and SortableTable instances.
 * Imported by tab modules which call these directly after data arrives.
 */
import { state, PAGE_SIZE } from './state.js';
import { fmt, fmtNum, esc, rarityBadge } from './utils.js';
import { SortableTable } from './sortable.js';

/* ─── Sales tables ───────────────────────────────────────────────────────── */

export function renderTopCardsRows(arr) {
  const totalCardRev = (state.currentData?.topCards || []).reduce((a, b) => a + (b.revenue || 0), 0);
  document.querySelector('#table-top-cards tbody').innerHTML = arr.map((c, i) => `
    <tr>
      <td class="dim">${i + 1}</td>
      <td data-card-name="${esc(c.card_name)}">${esc(c.card_name)}</td>
      <td class="dim">${esc(c.set_name)}</td>
      <td>${rarityBadge(c.rarity)}</td>
      <td class="mono">${fmtNum(c.qty_sold)}</td>
      <td class="mono gold">${fmt(c.revenue)}</td>
      <td class="mono dim">${totalCardRev > 0 ? (c.revenue / totalCardRev * 100).toFixed(1) + '%' : '-'}</td>
    </tr>`).join('');
}

export function renderSetsRows(arr) {
  const totalSetRev = (state.currentData?.bySet || []).reduce((a, b) => a + (b.revenue || 0), 0);
  document.querySelector('#table-sets tbody').innerHTML = arr.map(s => `
    <tr>
      <td>${s.set_name}</td>
      <td class="mono">${fmtNum(s.qty)}</td>
      <td class="mono gold">${fmt(s.revenue)}</td>
      <td class="mono dim">${totalSetRev > 0 ? (s.revenue / totalSetRev * 100).toFixed(1) + '%' : '-'}</td>
    </tr>`).join('');
}

export function renderOrdersRows(arr) {
  const q = document.getElementById('orders-search').value.toLowerCase().trim();
  const filtered = q ? arr.filter(o =>
    (o.buyer_name || '').toLowerCase().includes(q) ||
    (o.username   || '').toLowerCase().includes(q) ||
    (o.country    || '').toLowerCase().includes(q) ||
    (o.order_id   || '').toLowerCase().includes(q)
  ) : arr;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (state.orderPage > totalPages) { state.orderPage = totalPages; }
  const slice = filtered.slice((state.orderPage - 1) * PAGE_SIZE, state.orderPage * PAGE_SIZE);

  document.querySelector('#table-orders tbody').innerHTML = slice.map(o => `
    <tr data-username="${o.username}">
      <td class="mono dim">${o.order_id}</td>
      <td class="mono dim">${o.date_of_purchase?.substring(0, 10) || ''}</td>
      <td>${o.buyer_name || o.username}${o.is_professional ? ' <span class="badge badge-pro">PRO</span>' : ''}</td>
      <td>${o.country}</td>
      <td class="mono">${o.article_count}</td>
      <td class="mono gold">${fmt(o.merchandise_value)}</td>
      <td class="mono">${fmt(o.total_value)}</td>
      <td class="mono dim">${fmt(o.commission)}</td>
    </tr>`).join('');

  document.getElementById('orders-page-info').textContent =
    `${filtered.length} order${filtered.length !== 1 ? 's' : ''} · page ${state.orderPage} / ${totalPages}`;
  document.getElementById('orders-prev').disabled = state.orderPage <= 1;
  document.getElementById('orders-next').disabled = state.orderPage >= totalPages;
}

/* ─── Purchases tables ───────────────────────────────────────────────────── */

export function renderBoughtCardsRows(arr) {
  document.querySelector('#table-bought-cards tbody').innerHTML = arr.map((c, i) => `
    <tr>
      <td class="dim">${i + 1}</td>
      <td data-card-name="${esc(c.card_name)}">${esc(c.card_name)}</td>
      <td class="dim">${esc(c.set_name)}</td>
      <td>${rarityBadge(c.rarity)}</td>
      <td class="mono">${fmtNum(c.qty_bought)}</td>
      <td class="mono red">${fmt(c.spent)}</td>
      <td class="dim">${c.in_orders}</td>
    </tr>`).join('');
}

export function renderPurchasesRows(arr) {
  document.querySelector('#table-purchases tbody').innerHTML = arr.map(o => `
    <tr>
      <td class="mono dim">${o.order_id}</td>
      <td class="mono dim">${o.date_of_purchase?.substring(0, 10) || ''}</td>
      <td>${o.seller_name || o.seller_username}${o.is_professional ? ' <span class="badge badge-pro">PRO</span>' : ''}</td>
      <td>${o.country}</td>
      <td class="mono">${o.article_count}</td>
      <td class="mono red">${fmt(o.merchandise_value)}</td>
      <td class="mono dim">${fmt(o.total_value)}</td>
      <td class="mono dim">${fmt(o.trustee_fee)}</td>
    </tr>`).join('');
}

/* ─── Analytics tables ───────────────────────────────────────────────────── */

export function renderPnlRows(arr) {
  const tbody = document.querySelector('#table-pnl tbody');
  if (!tbody) { return; }
  tbody.innerHTML = arr.map(r => `
    <tr>
      <td data-card-name="${esc(r.card_name)}">${esc(r.card_name)}</td>
      <td>${esc(r.set_name || '—')}</td>
      <td>${r.qty_sold || 0}</td>
      <td>${fmt(r.total_revenue)}</td>
      <td>${fmt(r.total_cost)}</td>
      <td class="${(r.profit || 0) >= 0 ? 'profit-pos' : 'profit-neg'}">${fmt(r.profit)}</td>
      <td class="${(r.margin_pct || 0) >= 0 ? 'margin-pos' : 'margin-neg'}">${r.margin_pct != null ? r.margin_pct.toFixed(1) + '%' : '—'}</td>
    </tr>`).join('');
}

export function renderTimeToSellRows(arr) {
  const tbody = document.querySelector('#table-time-to-sell tbody');
  if (!tbody) { return; }
  tbody.innerHTML = arr.map(r => {
    const dv  = r.days_to_sell;
    const cls = dv === null ? '' : dv < 14 ? 'days-fast' : dv <= 60 ? 'days-medium' : 'days-slow';
    return `<tr>
      <td data-card-name="${esc(r.card_name)}">${esc(r.card_name)}</td>
      <td>${esc(r.set_name || '—')}</td>
      <td><span class="days-badge ${cls}">${dv === null ? '—' : dv + 'd'}</span></td>
    </tr>`;
  }).join('');
}

export function renderInventoryRows(arr) {
  const searchTerm = (document.getElementById('inventory-search')?.value || '').toLowerCase();
  const filtered   = searchTerm ? arr.filter(r => r.card_name.toLowerCase().includes(searchTerm)) : arr;
  const tbody = document.querySelector('#table-inventory tbody');
  if (!tbody) { return; }
  tbody.innerHTML = filtered.map(r => {
    const hasMkt = r.market_price != null;
    return `<tr>
      <td data-card-name="${esc(r.card_name)}">${esc(r.card_name)}</td>
      <td>${esc(r.set_name || '—')}</td>
      <td>${r.qty_bought || 0}</td>
      <td>${r.qty_sold || 0}</td>
      <td>${r.qty_on_hand || 0}</td>
      <td>${fmt(r.avg_buy_price)}</td>
      <td>${fmt(r.estimated_value)}</td>
      <td class="mono${hasMkt ? '' : ' dim'}">${hasMkt ? fmt(r.market_price) : '—'}</td>
      <td class="mono${hasMkt ? ' gold' : ' dim'}">${hasMkt ? fmt(r.market_value) : '—'}</td>
    </tr>`;
  }).join('');
}

export function renderRepeatBuyersRows(arr) {
  const tbody = document.querySelector('#table-repeat-buyers tbody');
  if (!tbody) { return; }
  tbody.innerHTML = arr.map(b => `
    <tr>
      <td>${esc(b.buyer)}</td>
      <td>${b.order_count || 0}</td>
      <td>${fmt(b.total_spent)}</td>
      <td>${fmt(b.avg_order_value)}</td>
    </tr>`).join('');
}

export function renderSetROIRows(arr) {
  const tbody = document.querySelector('#table-set-roi tbody');
  if (!tbody) { return; }
  tbody.innerHTML = arr.map(r => `
    <tr>
      <td>${esc(r.set_name)}</td>
      <td>${r.cards_sold || 0}</td>
      <td>${fmt(r.avg_buy_price)}</td>
      <td>${fmt(r.avg_sell_price)}</td>
      <td class="${(r.roi_pct || 0) >= 0 ? 'profit-pos' : 'profit-neg'}">${r.roi_pct != null ? r.roi_pct.toFixed(1) + '%' : '—'}</td>
    </tr>`).join('');
}

export function renderFoilPremiumRows(arr) {
  const tbody = document.querySelector('#table-foil-premium tbody');
  if (!tbody) { return; }
  tbody.innerHTML = arr.map(r => `
    <tr>
      <td data-card-name="${esc(r.card_name)}">${esc(r.card_name)}</td>
      <td>${fmt(r.avg_normal_price)}</td>
      <td>${fmt(r.avg_foil_price)}</td>
      <td>${r.foil_premium_pct != null ? r.foil_premium_pct.toFixed(1) + '%' : '—'}</td>
    </tr>`).join('');
}

/* ─── ManaBox table ──────────────────────────────────────────────────────── */

export function renderManaboxRows(arr) {
  const searchTerm = (document.getElementById('manabox-search')?.value || '').toLowerCase();
  const filtered   = searchTerm
    ? arr.filter(r => r.card_name.toLowerCase().includes(searchTerm) ||
                      (r.set_name || '').toLowerCase().includes(searchTerm))
    : arr;
  const tbody = document.querySelector('#table-manabox tbody');
  if (!tbody) { return; }
  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td data-card-name="${esc(r.card_name)}" data-scryfall-id="${esc(r.scryfall_id)}">${esc(r.card_name)}</td>
      <td class="dim">${esc(r.set_name || r.set_code || '—')}</td>
      <td class="mono dim">${r.set_code || ''}</td>
      <td>${r.is_foil ? '<span class="badge badge-uncommon">Foil</span>' : ''}</td>
      <td>${rarityBadge(r.rarity ? r.rarity.charAt(0).toUpperCase() + r.rarity.slice(1) : '')}</td>
      <td class="mono">${r.quantity || 1}</td>
      <td class="mono red">${fmt(r.purchase_price)}</td>
      <td class="dim">${esc(r.condition || '—')}</td>
      <td class="dim">${esc(r.language || '—')}</td>
    </tr>`).join('');
}

/* ─── SortableTable instances ────────────────────────────────────────────── */
// One per data table. Instantiated at module-load time (DOM is ready because the
// root script tag uses type="module" which is deferred by default).

export const stTopCards = new SortableTable('table-top-cards',
  [null, { key: 'card_name', type: 'str' }, { key: 'set_name', type: 'str' },
         { key: 'rarity', type: 'str' }, { key: 'qty_sold', type: 'num' },
         { key: 'revenue', type: 'num' }, null],
  renderTopCardsRows,
  () => state.currentData?.topCards || []);

export const stSets = new SortableTable('table-sets',
  [{ key: 'set_name', type: 'str' }, { key: 'qty', type: 'num' },
   { key: 'revenue', type: 'num' }, null],
  renderSetsRows,
  () => state.currentData?.bySet || []);

export const stOrders = new SortableTable('table-orders',
  [{ key: 'order_id', type: 'str' }, { key: 'date_of_purchase', type: 'str' },
   { key: 'buyer_name', type: 'str' }, { key: 'country', type: 'str' },
   { key: 'article_count', type: 'num' }, { key: 'merchandise_value', type: 'num' },
   { key: 'total_value', type: 'num' }, { key: 'commission', type: 'num' }],
  sorted => { state.ordersDisplayBase = sorted; state.orderPage = 1; renderOrdersRows(sorted); },
  () => state.currentData?.allOrders || []);

export const stBoughtCards = new SortableTable('table-bought-cards',
  [null, { key: 'card_name', type: 'str' }, { key: 'set_name', type: 'str' },
         { key: 'rarity', type: 'str' }, { key: 'qty_bought', type: 'num' },
         { key: 'spent', type: 'num' }, { key: 'in_orders', type: 'num' }],
  renderBoughtCardsRows,
  () => state.purchaseData?.topBoughtCards || []);

export const stPurchases = new SortableTable('table-purchases',
  [{ key: 'order_id', type: 'str' }, { key: 'date_of_purchase', type: 'str' },
   { key: 'seller_name', type: 'str' }, { key: 'country', type: 'str' },
   { key: 'article_count', type: 'num' }, { key: 'merchandise_value', type: 'num' },
   { key: 'total_value', type: 'num' }, { key: 'trustee_fee', type: 'num' }],
  renderPurchasesRows,
  () => state.purchaseData?.allPurchases || []);

export const stPnl = new SortableTable('table-pnl',
  [{ key: 'card_name', type: 'str' }, { key: 'set_name', type: 'str' },
   { key: 'qty_sold', type: 'num' }, { key: 'total_revenue', type: 'num' },
   { key: 'total_cost', type: 'num' }, { key: 'profit', type: 'num' },
   { key: 'margin_pct', type: 'num' }],
  renderPnlRows,
  () => state.analyticsData?.profitLoss || []);

export const stTimeToSell = new SortableTable('table-time-to-sell',
  [{ key: 'card_name', type: 'str' }, { key: 'set_name', type: 'str' },
   { key: 'days_to_sell', type: 'num' }],
  renderTimeToSellRows,
  () => state.analyticsData?.timeToSell || []);

export const stInventory = new SortableTable('table-inventory',
  [{ key: 'card_name', type: 'str' }, { key: 'set_name', type: 'str' },
   { key: 'qty_bought', type: 'num' }, { key: 'qty_sold', type: 'num' },
   { key: 'qty_on_hand', type: 'num' }, { key: 'avg_buy_price', type: 'num' },
   { key: 'estimated_value', type: 'num' }, { key: 'market_price', type: 'num' },
   { key: 'market_value', type: 'num' }],
  sorted => { state.sortedInventory = sorted; renderInventoryRows(sorted); },
  () => state.analyticsData?.inventory || []);

export const stRepeatBuyers = new SortableTable('table-repeat-buyers',
  [{ key: 'buyer', type: 'str' }, { key: 'order_count', type: 'num' },
   { key: 'total_spent', type: 'num' }, { key: 'avg_order_value', type: 'num' }],
  renderRepeatBuyersRows,
  () => state.analyticsData?.repeatBuyers?.buyers || []);

export const stSetROI = new SortableTable('table-set-roi',
  [{ key: 'set_name', type: 'str' }, { key: 'cards_sold', type: 'num' },
   { key: 'avg_buy_price', type: 'num' }, { key: 'avg_sell_price', type: 'num' },
   { key: 'roi_pct', type: 'num' }],
  renderSetROIRows,
  () => state.analyticsData?.setROI || []);

export const stFoilPremium = new SortableTable('table-foil-premium',
  [{ key: 'card_name', type: 'str' }, { key: 'avg_normal_price', type: 'num' },
   { key: 'avg_foil_price', type: 'num' }, { key: 'foil_premium_pct', type: 'num' }],
  renderFoilPremiumRows,
  () => state.analyticsData?.foilPremium || []);

export const stManabox = new SortableTable('table-manabox',
  [{ key: 'card_name', type: 'str' }, { key: 'set_name', type: 'str' },
   { key: 'set_code', type: 'str' }, { key: 'is_foil', type: 'str' },
   { key: 'rarity', type: 'str' }, { key: 'quantity', type: 'num' },
   { key: 'purchase_price', type: 'num' }, { key: 'condition', type: 'str' },
   { key: 'language', type: 'str' }],
  sorted => { state.sortedManabox = sorted; renderManaboxRows(sorted); },
  () => state.manaboxItems || []);
