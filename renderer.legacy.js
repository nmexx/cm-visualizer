/* ─── Chart.js global config ──────────────────────────────────────────────── */
Chart.defaults.color = '#6b7a94';
Chart.defaults.borderColor = '#1e2a3a';
Chart.defaults.font.family = "'Rajdhani', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.padding = 14;

const GOLD_PALETTE = [
  '#c9a227','#e8c547','#9b7b1e','#3d8ef0','#2ecc71',
  '#9b59b6','#e74c3c','#7ecfdd','#e8752a','#6b7a94'
];

/* ─── State ───────────────────────────────────────────────────────────────── */
let charts            = {};
let currentData       = null;
let purchaseData      = null;
let analyticsData     = null;
let filters           = {};
let orderPage         = 1;
const PAGE_SIZE       = 50;
let ordersDisplayBase = null;   // sorted override for orders table (null = use allOrders)
let sortedInventory   = null;   // sorted override for inventory table
let sortedManabox     = null;   // sorted override for manabox table
// SortableTable instances (initialised at bottom of file, before init())
let stTopCards, stSets, stOrders, stBoughtCards, stPurchases;
let stPnl, stTimeToSell, stInventory, stRepeatBuyers, stSetROI, stFoilPremium, stManabox;

/* ─── Navigation ──────────────────────────────────────────────────────────── */
document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
  });
});

/* ─── Toast & Loading ─────────────────────────────────────────────────────── */
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show ' + type;
  setTimeout(() => { el.className = ''; }, 3500);
}

function showLoading(v) {
  document.getElementById('loading').classList.toggle('show', v);
}

/* ─── Formatting ──────────────────────────────────────────────────────────── */
function fmt(n) {
  if (n === undefined || n === null) { return '€0.00'; }
  return '€' + (+n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtNum(n) {
  return (+n || 0).toLocaleString();
}

function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rarityBadge(r) {
  if (!r) { return ''; }
  const cls = { Mythic: 'mythic', Rare: 'rare', Uncommon: 'uncommon', Common: 'common', Land: 'land' }[r] || 'common';
  return `<span class="badge badge-${cls}">${r}</span>`;
}

function trendHtml(curr, prev) {
  if (!prev || prev === 0) { return ''; }
  const pct = ((curr - prev) / Math.abs(prev) * 100);
  if (Math.abs(pct) < 0.5) { return '<span class="kpi-trend flat">→ unchanged</span>'; }
  const dir = pct > 0 ? 'up' : 'down';
  const arrow = pct > 0 ? '▲' : '▼';
  return `<span class="kpi-trend ${dir}">${arrow} ${Math.abs(pct).toFixed(1)}% vs prior period</span>`;
}

/* ─── Missing months banner ───────────────────────────────────────────────── */
function renderMissingMonths(months, containerId) {
  const el = document.getElementById(containerId);
  if (!el) { return; }
  if (!months || !months.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = `
    <span class="warn-icon">⚠️</span>
    <div>
      <strong>Missing monthly data detected.</strong>
      Cardmarket exports are per month — the following months have no data imported yet:
      <span class="warn-months">${months.join(', ')}</span>
      <br><span style="color:var(--text-dim);font-size:12px">Download each missing month from Cardmarket → Orders → "Sold Orders" / "Purchased Orders" and import.</span>
    </div>`;
}

/* ─── Chart helpers ───────────────────────────────────────────────────────── */
function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function lineChart(id, labels, data, label = 'Revenue') {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx) { return; }
  charts[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label, data, borderColor: '#c9a227', backgroundColor: 'rgba(201,162,39,0.08)',
        tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: '#c9a227' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#1e2a3a' }, ticks: { maxTicksLimit: 8 } },
        y: { grid: { color: '#1e2a3a' }, ticks: { callback: v => '€' + v.toFixed(0) } }
      }
    }
  });
}

function lineChart2(id, labels, data, label = 'Amount', color = '#3d8ef0') {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx) { return; }
  charts[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label, data, borderColor: color, backgroundColor: color + '15',
        tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: color }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#1e2a3a' }, ticks: { maxTicksLimit: 8 } },
        y: { grid: { color: '#1e2a3a' }, ticks: { callback: v => '€' + v.toFixed(0) } }
      }
    }
  });
}

function barChart(id, labels, datasets, options = {}) {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx) { return; }
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: options.legend || { display: false } },
      scales: {
        x: { grid: { display: false }, ...(options.stacked ? { stacked: true } : {}) },
        y: { grid: { color: '#1e2a3a' }, ticks: { callback: v => '€' + v.toFixed(0) }, ...(options.stacked ? { stacked: true } : {}) }
      },
      indexAxis: options.horizontal ? 'y' : 'x',
      ...options.extra
    }
  });
}

function doughnutChart(id, labels, data, colors) {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx) { return; }
  charts[id] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors || GOLD_PALETTE, borderWidth: 1, borderColor: '#080b12' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } },
      cutout: '60%'
    }
  });
}

function hbarChart(id, labels, data, color = '#c9a227') {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx) { return; }
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: color + '99', borderColor: color, borderWidth: 1 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#1e2a3a' }, ticks: { callback: v => '€' + v.toFixed(0) } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

/* ─── Sort utilities ────────────────────────────────────────────────────────── */
/**
 * Return a sorted shallow copy of `arr` by the given object property key.
 * (Same logic lives in lib/sortUtils.js for unit-testing.)
 * @param {Object[]}     arr  - source array (never mutated)
 * @param {string}       key  - property name to sort by
 * @param {'str'|'num'}  type - 'num' = numeric, 'str' = locale string
 * @param {'asc'|'desc'} dir  - sort direction
 * @returns {Object[]} new sorted array
 */
function sortArray(arr, key, type, dir) {
  const d = dir === 'desc' ? -1 : 1;
  return [...arr].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (type === 'num') {
      return d * ((parseFloat(av) || 0) - (parseFloat(bv) || 0));
    }
    return d * String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

/**
 * Attaches click-to-sort behaviour to a `.data-table`.
 * @param {string}   tableId   - DOM id of the <table>
 * @param {Array<{key:string,type:'str'|'num'}|null>} cols
 *   One entry per <th>. Use null for columns that should not be sortable (e.g. rank "#").
 * @param {function(any[]): void} renderFn
 *   Called with the sorted array to re-render the tbody.
 * @param {function(): any[]} getDataFn
 *   Returns the current canonical (unsorted) source array.
 */
class SortableTable {
  constructor(tableId, cols, renderFn, getDataFn) {
    this.tableId   = tableId;
    this.cols      = cols;
    this.renderFn  = renderFn;
    this.getDataFn = getDataFn;
    this.sortCol   = -1;
    this.sortDir   = 'asc';
    this._init();
  }

  _init() {
    const table = document.getElementById(this.tableId);
    if (!table) { return; }
    table.querySelectorAll('thead th').forEach((th, i) => {
      if (!this.cols[i]) { return; }
      th.classList.add('sortable');
      th.addEventListener('click', () => this._sort(i));
    });
  }

  _sort(col) {
    const table = document.getElementById(this.tableId);
    if (!table || !this.cols[col]) { return; }
    this.sortDir = (this.sortCol === col && this.sortDir === 'asc') ? 'desc' : 'asc';
    this.sortCol = col;
    table.querySelectorAll('thead th').forEach((th, i) => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (i === col) { th.classList.add('sort-' + this.sortDir); }
    });
    const { key, type } = this.cols[col];
    this.renderFn(sortArray(this.getDataFn(), key, type, this.sortDir));
  }

  /** Reset visual indicators and internal state (call when data reloads). */
  reset() {
    this.sortCol = -1;
    this.sortDir = 'asc';
    const table = document.getElementById(this.tableId);
    if (table) {
      table.querySelectorAll('thead th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
    }
  }
}

/* ─── Per-table tbody render functions ─────────────────────────────────────── */

function renderTopCardsRows(arr) {
  const totalCardRev = (currentData?.topCards || []).reduce((a, b) => a + (b.revenue || 0), 0);
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

function renderSetsRows(arr) {
  const totalSetRev = (currentData?.bySet || []).reduce((a, b) => a + (b.revenue || 0), 0);
  document.querySelector('#table-sets tbody').innerHTML = arr.map(s => `
    <tr>
      <td>${s.set_name}</td>
      <td class="mono">${fmtNum(s.qty)}</td>
      <td class="mono gold">${fmt(s.revenue)}</td>
      <td class="mono dim">${totalSetRev > 0 ? (s.revenue / totalSetRev * 100).toFixed(1) + '%' : '-'}</td>
    </tr>`).join('');
}

function renderBoughtCardsRows(arr) {
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

function renderPurchasesRows(arr) {
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

function renderPnlRows(arr) {
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

function renderTimeToSellRows(arr) {
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

function renderInventoryRows(arr) {
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

function renderRepeatBuyersRows(arr) {
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

function renderSetROIRows(arr) {
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

function renderFoilPremiumRows(arr) {
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

function renderManaboxRows(arr) {
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

/* ─── Render: Sales dashboard ─────────────────────────────────────────────── */
function renderDashboard(d) {
  currentData = d;
  const s = d.summary || {};
  const hasData = (s.total_orders || 0) > 0;

  document.getElementById('empty-state').style.display = hasData ? 'none' : 'flex';
  document.getElementById('dashboard-content').style.display = hasData ? 'block' : 'none';

  if (!hasData) { return; }

  document.getElementById('status-orders').textContent  = fmtNum(s.total_orders) + ' orders';
  document.getElementById('status-revenue').textContent = fmt(s.total_revenue) + ' revenue';

  renderMissingMonths(d.missingMonths, 'missing-months-sales');

  /* KPIs with trend indicators */
  const netRevenue = (s.total_revenue || 0) - (s.total_commission || 0);
  const commRate   = s.total_revenue > 0
    ? ((s.total_commission / s.total_revenue) * 100).toFixed(1) + '%' : '0%';
  const p = d.prevSummary || {};
  const prevNet = (p.total_revenue || 0) - (p.total_commission || 0);

  const kpis = [
    { label: 'Total Revenue',   value: fmt(s.total_revenue),    cls: 'gold',  trend: trendHtml(s.total_revenue, p.total_revenue) },
    { label: 'Net Revenue',     value: fmt(netRevenue),          cls: 'green', trend: trendHtml(netRevenue, prevNet) },
    { label: 'Orders',          value: fmtNum(s.total_orders),   cls: '',      trend: trendHtml(s.total_orders, p.total_orders) },
    { label: 'Unique Buyers',   value: fmtNum(s.unique_buyers),  cls: 'blue',  trend: '' },
    { label: 'Cards Sold',      value: fmtNum(s.total_articles), cls: '',      trend: trendHtml(s.total_articles, p.total_articles) },
    { label: 'Avg Order Value', value: fmt(s.avg_order_value),   cls: '',      trend: '' },
    { label: 'Commission Rate', value: commRate,                 cls: '',      trend: '' },
    { label: 'Commission Paid', value: fmt(s.total_commission),  cls: '',      trend: '' },
  ];

  document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
    <div class="kpi">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value ${k.cls}">${k.value}</div>
      ${k.trend || ''}
    </div>`).join('');

  /* Charts */
  if (d.revenueByDay?.length) {
    lineChart('chart-revenue-time', d.revenueByDay.map(r => r.day), d.revenueByDay.map(r => r.revenue));
  }
  if (d.profitByMonth?.length) {
    barChart('chart-monthly', d.profitByMonth.map(r => r.month), [
      { label: 'Revenue',    data: d.profitByMonth.map(r => r.revenue),    backgroundColor: '#c9a22799', borderColor: '#c9a227', borderWidth: 1 },
      { label: 'Commission', data: d.profitByMonth.map(r => r.commission), backgroundColor: '#e74c3c66', borderColor: '#e74c3c', borderWidth: 1 }
    ], { legend: { display: true, labels: { color: '#6b7a94' } } });
  }
  if (d.revenueByCountry?.length) {
    hbarChart('chart-countries', d.revenueByCountry.slice(0, 8).map(r => r.country), d.revenueByCountry.slice(0, 8).map(r => r.revenue), '#3d8ef0');
  }

  const foil   = d.foilVsNormal?.find(r => r.is_foil) || {};
  const normal = d.foilVsNormal?.find(r => !r.is_foil) || {};
  doughnutChart('chart-foil', ['Foil', 'Normal'], [foil.revenue || 0, normal.revenue || 0], ['#7ecfdd', '#3d3d5a']);

  if (d.byRarity?.length) {
    doughnutChart('chart-rarity', d.byRarity.map(r => r.rarity), d.byRarity.map(r => r.revenue),
      ['#e8752a', '#c9a227', '#aab8c8', '#9aa0a8', '#3d8ef0']);
  }

  /* Cards page */
  if (d.byLanguage?.length) {
    hbarChart('chart-language', d.byLanguage.map(r => r.language), d.byLanguage.map(r => r.revenue), '#9b59b6');
  }
  if (d.byRarity?.length) {
    barChart('chart-rarity2', d.byRarity.map(r => r.rarity), [{
      data: d.byRarity.map(r => r.revenue),
      backgroundColor: ['#e8752a99','#c9a22799','#aab8c899','#9aa0a899','#3d8ef099'],
      borderColor: ['#e8752a','#c9a227','#aab8c8','#9aa0a8','#3d8ef0'], borderWidth: 1
    }]);
  }

  /* Top cards table */
  renderTopCardsRows(d.topCards || []);

  /* Condition chart */
  if (d.byCondition?.length) {
    doughnutChart('chart-condition', d.byCondition.map(r => r.condition), d.byCondition.map(r => r.qty), GOLD_PALETTE);
  }

  /* Orders table with pagination */
  orderPage = 1;
  renderOrdersPage(d.allOrders || []);

  /* Sets page */
  if (d.bySet?.length) {
    hbarChart('chart-sets',
      d.bySet.slice(0, 10).map(r => r.set_name?.length > 28 ? r.set_name.substring(0, 28) + '…' : r.set_name),
      d.bySet.slice(0, 10).map(r => r.revenue), '#2ecc71');
  }
  if (d.profitByMonth?.length) {
    lineChart('chart-monthly2', d.profitByMonth.map(r => r.month), d.profitByMonth.map(r => r.revenue));
  }

  renderSetsRows(d.bySet || []);
}

/* ─── Orders pagination ────────────────────────────────────────────────────── */
function renderOrdersPage(orders) {
  const q      = document.getElementById('orders-search').value.toLowerCase().trim();
  const filtered = q ? orders.filter(o =>
    (o.buyer_name || '').toLowerCase().includes(q) ||
    (o.username || '').toLowerCase().includes(q) ||
    (o.country || '').toLowerCase().includes(q) ||
    (o.order_id || '').toLowerCase().includes(q)
  ) : orders;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (orderPage > totalPages) { orderPage = totalPages; }
  const slice = filtered.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE);

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

  /* Pagination controls */
  document.getElementById('orders-page-info').textContent =
    `${filtered.length} order${filtered.length !== 1 ? 's' : ''} · page ${orderPage} / ${totalPages}`;
  document.getElementById('orders-prev').disabled = orderPage <= 1;
  document.getElementById('orders-next').disabled = orderPage >= totalPages;

  /* Row click → buyer modal */
  document.querySelectorAll('#table-orders tbody tr').forEach(row => {
    row.addEventListener('click', () => {
      const username = row.dataset.username;
      if (username && currentData?.allOrders) {
        showBuyerModal(username, currentData.allOrders);
      }
    });
  });
}

document.getElementById('orders-search').addEventListener('input', () => {
  orderPage = 1;
  if (currentData) { renderOrdersPage(ordersDisplayBase || currentData.allOrders || []); }
});
document.getElementById('orders-prev').addEventListener('click', () => {
  orderPage--;
  if (currentData) { renderOrdersPage(ordersDisplayBase || currentData.allOrders || []); }
});
document.getElementById('orders-next').addEventListener('click', () => {
  orderPage++;
  if (currentData) { renderOrdersPage(ordersDisplayBase || currentData.allOrders || []); }
});

/* ─── Buyer detail modal ──────────────────────────────────────────────────── */
function showBuyerModal(username, allOrders) {
  const orders = allOrders.filter(o => o.username === username);
  if (!orders.length) { return; }

  const totalRev  = orders.reduce((s, o) => s + (o.merchandise_value || 0), 0);
  const totalPaid = orders.reduce((s, o) => s + (o.total_value || 0), 0);
  const buyerName = orders[0].buyer_name || username;

  document.getElementById('modal-title-text').textContent = buyerName;
  document.getElementById('modal-kpis').innerHTML = `
    <div class="modal-kpi"><div class="label">Orders</div><div class="value">${orders.length}</div></div>
    <div class="modal-kpi"><div class="label">Total Spent</div><div class="value gold">${fmt(totalRev)}</div></div>
    <div class="modal-kpi"><div class="label">Total Paid</div><div class="value">${fmt(totalPaid)}</div></div>
    <div class="modal-kpi"><div class="label">Cards Bought</div><div class="value">${fmtNum(orders.reduce((s, o) => s + (o.article_count || 0), 0))}</div></div>
    <div class="modal-kpi"><div class="label">Avg Order</div><div class="value">${fmt(totalRev / orders.length)}</div></div>`;

  document.getElementById('modal-orders-body').innerHTML = orders.map(o => `
    <tr>
      <td class="mono dim">${o.date_of_purchase?.substring(0, 10) || ''}</td>
      <td class="mono dim">${o.order_id}</td>
      <td class="mono">${o.article_count}</td>
      <td class="mono gold">${fmt(o.merchandise_value)}</td>
      <td class="mono dim">${fmt(o.commission)}</td>
    </tr>`).join('');

  document.getElementById('buyer-modal').classList.add('show');
}

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('buyer-modal').classList.remove('show');
});
document.getElementById('buyer-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('buyer-modal')) {
    document.getElementById('buyer-modal').classList.remove('show');
  }
});

/* ─── Render: Purchases dashboard ─────────────────────────────────────────── */
function renderPurchases(d) {
  purchaseData = d;
  const s = d.summary || {};
  const hasData = (s.total_orders || 0) > 0;

  document.getElementById('purchase-empty-state').style.display = hasData ? 'none' : 'flex';
  document.getElementById('purchase-dashboard').style.display   = hasData ? 'block' : 'none';

  if (!hasData) { return; }

  renderMissingMonths(d.missingMonths, 'missing-months-purchases');

  const kpis = [
    { label: 'Total Spent',     value: fmt(s.total_spent),       cls: 'red'   },
    { label: 'Total Paid',      value: fmt(s.total_paid),        cls: ''      },
    { label: 'Orders',          value: fmtNum(s.total_orders),   cls: ''      },
    { label: 'Unique Sellers',  value: fmtNum(s.unique_sellers), cls: 'blue'  },
    { label: 'Cards Bought',    value: fmtNum(s.total_articles), cls: ''      },
    { label: 'Avg Order Value', value: fmt(s.avg_order_value),   cls: ''      },
    { label: 'Total Shipping',  value: fmt(s.total_shipping),    cls: ''      },
    { label: 'Trustee Fees',    value: fmt(s.total_fees),        cls: ''      },
  ];

  document.getElementById('purchase-kpi-grid').innerHTML = kpis.map(k => `
    <div class="kpi">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value ${k.cls}">${k.value}</div>
    </div>`).join('');

  if (d.spendByDay?.length) {
    lineChart2('chart-spend-time', d.spendByDay.map(r => r.day), d.spendByDay.map(r => r.spent), 'Daily Spend', '#e74c3c');
  }
  if (d.spendByMonth?.length) {
    barChart('chart-spend-monthly', d.spendByMonth.map(r => r.month), [
      { label: 'Spent', data: d.spendByMonth.map(r => r.spent), backgroundColor: '#e74c3c66', borderColor: '#e74c3c', borderWidth: 1 },
      { label: 'Fees',  data: d.spendByMonth.map(r => r.fees),  backgroundColor: '#9b59b666', borderColor: '#9b59b6', borderWidth: 1 }
    ], { legend: { display: true, labels: { color: '#6b7a94' } } });
  }
  if (d.topSellers?.length) {
    hbarChart('chart-top-sellers', d.topSellers.slice(0, 8).map(r => r.seller_username), d.topSellers.slice(0, 8).map(r => r.spent), '#e74c3c');
  }
  if (d.byCountry?.length) {
    hbarChart('chart-purchase-countries', d.byCountry.slice(0, 8).map(r => r.country), d.byCountry.slice(0, 8).map(r => r.spent), '#3d8ef0');
  }
  if (d.byRarity?.length) {
    doughnutChart('chart-purchase-rarity', d.byRarity.map(r => r.rarity), d.byRarity.map(r => r.spent),
      ['#e8752a', '#c9a227', '#aab8c8', '#9aa0a8', '#3d8ef0']);
  }

  /* Top bought cards table */
  renderBoughtCardsRows(d.topBoughtCards || []);

  /* Purchases table */
  renderPurchasesRows(d.allPurchases || []);
}

/* ─── Load data ────────────────────────────────────────────────────────────── */
function buildFilters() {
  const f = {};
  const from = document.getElementById('filter-from').value;
  const to   = document.getElementById('filter-to').value;
  if (from) { f.dateFrom = from; }
  if (to)   { f.dateTo   = to; }
  return f;
}

async function loadData() {
  ordersDisplayBase = null;
  stTopCards?.reset(); stSets?.reset(); stOrders?.reset();
  const f    = buildFilters();
  const data = await window.mtg.getStats(f);
  renderDashboard(data);
}

async function loadPurchaseData() {
  stBoughtCards?.reset(); stPurchases?.reset();
  const f    = buildFilters();
  const data = await window.mtg.getPurchaseStats(f);
  renderPurchases(data);
}

/* ─── Import buttons ──────────────────────────────────────────────────────── */
document.getElementById('btn-import-file').addEventListener('click', async () => {
  showLoading(true);
  const result = await window.mtg.importFile();
  showLoading(false);
  if (!result) { return; }
  toast(`Imported ${result.totalInserted} orders, ${result.totalSkipped} already existed`);
  loadData();
});

document.getElementById('btn-import-folder').addEventListener('click', async () => {
  const settings = await window.mtg.getSettings();
  const folder   = settings.csv_folder_sold || settings.csv_folder;
  if (!folder) { toast('No sold folder configured — go to Settings first', 'error'); return; }
  showLoading(true);
  const result = await window.mtg.importFolder(folder);
  showLoading(false);
  if (result.error) { toast(result.error, 'error'); return; }
  toast(`Synced: ${result.totalInserted} new, ${result.totalSkipped} existing`);
  loadData();
});

document.getElementById('btn-import-purchases').addEventListener('click', async () => {
  showLoading(true);
  const result = await window.mtg.importPurchaseFile();
  showLoading(false);
  if (!result) { return; }
  toast(`Purchases imported: ${result.totalInserted} new, ${result.totalSkipped} existing`);
  loadPurchaseData();
});

document.getElementById('btn-import-inventory').addEventListener('click', async () => {
  showLoading(true);
  const result = await window.mtg.importInventoryFile();
  showLoading(false);
  if (!result) { return; }
  toast(`Inventory imported: ${result.totalInserted} new, ${result.totalSkipped} existing`);
  loadManaboxInventory();
});

/* ─── Filter buttons ──────────────────────────────────────────────────────── */
document.getElementById('btn-apply-filter').addEventListener('click', () => {
  loadData();
  loadPurchaseData();
  loadAnalyticsData();
});
document.getElementById('btn-clear-filter').addEventListener('click', () => {
  document.getElementById('filter-from').value = '';
  document.getElementById('filter-to').value   = '';
  loadData();
  loadPurchaseData();
  loadAnalyticsData();
});

/* ─── Export buttons ──────────────────────────────────────────────────────── */
document.getElementById('btn-export-orders').addEventListener('click', async () => {
  const r = await window.mtg.exportCsv('orders');
  if (r?.ok) { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
document.getElementById('btn-export-cards').addEventListener('click', async () => {
  const r = await window.mtg.exportCsv('top-cards');
  if (r?.ok) { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
document.getElementById('btn-export-purchases').addEventListener('click', async () => {
  const r = await window.mtg.exportCsv('purchases');
  if (r?.ok) { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});

/* ─── Settings ────────────────────────────────────────────────────────────── */
document.getElementById('btn-set-folder-sold').addEventListener('click', async () => {
  const folder = await window.mtg.setFolderSold();
  if (!folder) { return; }
  document.getElementById('setting-folder-sold').textContent = folder;
  showLoading(true);
  const result = await window.mtg.importFolder(folder);
  showLoading(false);
  if (result.error) { toast(result.error, 'error'); return; }
  toast(`Sold folder set. Imported ${result.totalInserted} orders.`);
  loadData();
});

document.getElementById('btn-set-folder-purchased').addEventListener('click', async () => {  
  const folder = await window.mtg.setFolderPurchased();
  if (!folder) { return; }
  document.getElementById('setting-folder-purchased').textContent = folder;
  toast(`Purchased folder set. Auto-sync active for: ${folder.split(/[\\/]/).pop()}`);
});

document.getElementById('btn-set-inventory-file')?.addEventListener('click', async () => {
  const result = await window.mtg.setInventoryFile();
  if (!result) { return; }
  if (result.error) { toast('Inventory error: ' + result.error, 'error'); return; }
  const el = document.getElementById('setting-inventory-file');
  if (el) { el.textContent = result.path.split(/[/\\]/).pop(); }
  toast(`Inventory file set. Imported ${result.inserted} new, ${result.skipped} existing`);
  loadManaboxInventory();
});

document.getElementById('btn-download-price-guide')?.addEventListener('click', async () => {
  const statusEl = document.getElementById('price-guide-status');
  if (statusEl) { statusEl.textContent = 'Downloading…'; }
  showLoading(true);
  const result = await window.mtg.downloadPriceGuide();
  showLoading(false);
  if (!result.ok) {
    if (statusEl) { statusEl.textContent = 'Error: ' + (result.error || 'failed'); }
    toast('Price guide download failed: ' + (result.error || ''), 'error');
    return;
  }
  const when = new Date(result.updatedAt).toLocaleString();
  if (statusEl) { statusEl.textContent = `${result.count.toLocaleString()} products`; }
  const pgEl = document.getElementById('setting-price-guide-updated');
  if (pgEl) { pgEl.textContent = when; }
  toast(`Price guide downloaded: ${result.count.toLocaleString()} products`);
  // Reload analytics so inventory gets enriched with fresh market prices
  loadAnalyticsData();
});

document.getElementById('btn-clear-db').addEventListener('click', async () => {
  if (!confirm('This will delete ALL sales and purchase data. Are you sure?')) { return; }
  await window.mtg.clearDatabase();
  toast('Database cleared');
  loadData();
  loadPurchaseData();
});

/* ─── Auto-import (chokidar) ──────────────────────────────────────────────── */
window.mtg.onAutoImport(data => {
  toast(`Auto-imported: ${data.file} (+${data.inserted} orders)`);
  loadData();
  loadAnalyticsData();
});
window.mtg.onAutoImportPurchase(data => {
  toast(`Auto-imported purchases: ${data.file} (+${data.inserted} orders)`);
  loadPurchaseData();
  loadAnalyticsData();
});

/* ─── Init ─────────────────────────────────────────────────────────────────── */
async function init() {
  const [settings, dbPath] = await Promise.all([
    window.mtg.getSettings(),
    window.mtg.getDbPath()
  ]);

  const soldFolder = settings.csv_folder_sold || settings.csv_folder;
  const purchasedFolder = settings.csv_folder_purchased;
  if (soldFolder) {
    document.getElementById('setting-folder-sold').textContent = soldFolder;
  }
  if (purchasedFolder) {
    document.getElementById('setting-folder-purchased').textContent = purchasedFolder;
  }
  const inventoryFilePath = settings.inventory_file_path;
  if (inventoryFilePath) {
    const el = document.getElementById('setting-inventory-file');
    if (el) { el.textContent = inventoryFilePath.split(/[\\/]/).pop(); }
  }
  const priceGuideUpdatedAt = settings.price_guide_updated_at;
  const pgEl = document.getElementById('setting-price-guide-updated');
  if (pgEl) {
    pgEl.textContent = priceGuideUpdatedAt
      ? new Date(priceGuideUpdatedAt).toLocaleString()
      : 'Never';
  }
  document.getElementById('setting-db-path').textContent = dbPath || '';
  document.getElementById('db-path-status').textContent  = dbPath ? dbPath.split(/[\\/]/).pop() : '';

  // Restore theme
  const savedTheme = settings.theme || 'dark';
  applyTheme(savedTheme);

  // Load filter presets
  await refreshPresetSelect();

  await Promise.all([loadData(), loadPurchaseData(), loadAnalyticsData(), loadManaboxInventory()]);
}

/* ─── SortableTable instances ───────────────────────────────────────────────── */
// One instance per data table. Cols array: null = not sortable (rank column etc.)
// Initialised synchronously here so click handlers are active from page load.

stTopCards = new SortableTable('table-top-cards',
  [null, { key: 'card_name', type: 'str' }, { key: 'set_name', type: 'str' },
         { key: 'rarity', type: 'str' }, { key: 'qty_sold', type: 'num' },
         { key: 'revenue', type: 'num' }, null],
  renderTopCardsRows,
  () => currentData?.topCards || []);

stSets = new SortableTable('table-sets',
  [{ key: 'set_name', type: 'str' }, { key: 'qty', type: 'num' },
   { key: 'revenue', type: 'num' }, null],
  renderSetsRows,
  () => currentData?.bySet || []);

stOrders = new SortableTable('table-orders',
  [{ key: 'order_id', type: 'str' }, { key: 'date_of_purchase', type: 'str' },
   { key: 'buyer_name', type: 'str' }, { key: 'country', type: 'str' },
   { key: 'article_count', type: 'num' }, { key: 'merchandise_value', type: 'num' },
   { key: 'total_value', type: 'num' }, { key: 'commission', type: 'num' }],
  (sorted) => { ordersDisplayBase = sorted; orderPage = 1; renderOrdersPage(sorted); },
  () => currentData?.allOrders || []);

stBoughtCards = new SortableTable('table-bought-cards',
  [null, { key: 'card_name', type: 'str' }, { key: 'set_name', type: 'str' },
         { key: 'rarity', type: 'str' }, { key: 'qty_bought', type: 'num' },
         { key: 'spent', type: 'num' }, { key: 'in_orders', type: 'num' }],
  renderBoughtCardsRows,
  () => purchaseData?.topBoughtCards || []);

stPurchases = new SortableTable('table-purchases',
  [{ key: 'order_id', type: 'str' }, { key: 'date_of_purchase', type: 'str' },
   { key: 'seller_name', type: 'str' }, { key: 'country', type: 'str' },
   { key: 'article_count', type: 'num' }, { key: 'merchandise_value', type: 'num' },
   { key: 'total_value', type: 'num' }, { key: 'trustee_fee', type: 'num' }],
  renderPurchasesRows,
  () => purchaseData?.allPurchases || []);

stPnl = new SortableTable('table-pnl',
  [{ key: 'card_name', type: 'str' }, { key: 'set_name', type: 'str' },
   { key: 'qty_sold', type: 'num' }, { key: 'total_revenue', type: 'num' },
   { key: 'total_cost', type: 'num' }, { key: 'profit', type: 'num' },
   { key: 'margin_pct', type: 'num' }],
  renderPnlRows,
  () => analyticsData?.profitLoss || []);

stTimeToSell = new SortableTable('table-time-to-sell',
  [{ key: 'card_name', type: 'str' }, { key: 'set_name', type: 'str' },
   { key: 'days_to_sell', type: 'num' }],
  renderTimeToSellRows,
  () => analyticsData?.timeToSell || []);

stInventory = new SortableTable('table-inventory',
  [{ key: 'card_name', type: 'str' }, { key: 'set_name', type: 'str' },
   { key: 'qty_bought', type: 'num' }, { key: 'qty_sold', type: 'num' },
   { key: 'qty_on_hand', type: 'num' }, { key: 'avg_buy_price', type: 'num' },
   { key: 'estimated_value', type: 'num' }, { key: 'market_price', type: 'num' },
   { key: 'market_value', type: 'num' }],
  (sorted) => { sortedInventory = sorted; renderInventoryRows(sorted); },
  () => analyticsData?.inventory || []);

stRepeatBuyers = new SortableTable('table-repeat-buyers',
  [{ key: 'buyer', type: 'str' }, { key: 'order_count', type: 'num' },
   { key: 'total_spent', type: 'num' }, { key: 'avg_order_value', type: 'num' }],
  renderRepeatBuyersRows,
  () => analyticsData?.repeatBuyers?.buyers || []);

stSetROI = new SortableTable('table-set-roi',
  [{ key: 'set_name', type: 'str' }, { key: 'cards_sold', type: 'num' },
   { key: 'avg_buy_price', type: 'num' }, { key: 'avg_sell_price', type: 'num' },
   { key: 'roi_pct', type: 'num' }],
  renderSetROIRows,
  () => analyticsData?.setROI || []);

stFoilPremium = new SortableTable('table-foil-premium',
  [{ key: 'card_name', type: 'str' }, { key: 'avg_normal_price', type: 'num' },
   { key: 'avg_foil_price', type: 'num' }, { key: 'foil_premium_pct', type: 'num' }],
  renderFoilPremiumRows,
  () => analyticsData?.foilPremium || []);

stManabox = new SortableTable('table-manabox',
  [{ key: 'card_name', type: 'str' }, { key: 'set_name', type: 'str' },
   { key: 'set_code', type: 'str' }, { key: 'is_foil', type: 'str' },
   { key: 'rarity', type: 'str' }, { key: 'quantity', type: 'num' },
   { key: 'purchase_price', type: 'num' }, { key: 'condition', type: 'str' },
   { key: 'language', type: 'str' }],
  (sorted) => { sortedManabox = sorted; renderManaboxRows(sorted); },
  () => manaboxItems || []);

init();

/* ─── Analytics loading ────────────────────────────────────────────────────── */
async function loadAnalyticsData() {
  sortedInventory = null;
  stPnl?.reset(); stTimeToSell?.reset(); stInventory?.reset();
  stRepeatBuyers?.reset(); stSetROI?.reset(); stFoilPremium?.reset();
  const f = buildFilters();
  const data = await window.mtg.getAnalytics(f);
  analyticsData = data;
  renderAnalytics(data);
  renderRepeatBuyers(data.repeatBuyers);
  renderSetROI(data.setROI);
  renderFoilPremium(data.foilPremium);
  if (data.inventory) { renderInventory(data.inventory); }
}

/* ─── Render P&L page ──────────────────────────────────────────────────────── */
function renderAnalytics(d) {
  if (!d) return;
  const { profitLoss, timeToSell } = d;

  const empty = document.getElementById('pnl-empty-state');
  const dash  = document.getElementById('pnl-dashboard');
  if (!profitLoss || profitLoss.length === 0) {
    if (empty) empty.style.display = '';
    if (dash)  dash.style.display  = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (dash)  dash.style.display  = '';

  const totalRevenue  = profitLoss.reduce((s, r) => s + (r.total_revenue  || 0), 0);
  const totalCost     = profitLoss.reduce((s, r) => s + (r.total_cost     || 0), 0);
  const totalProfit   = profitLoss.reduce((s, r) => s + (r.profit         || 0), 0);
  const profitable    = profitLoss.filter(r => (r.profit || 0) > 0).length;
  const profitPct     = profitLoss.length ? Math.round(profitable / profitLoss.length * 100) : 0;

  const kpiGrid = document.getElementById('pnl-kpi-grid');
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Total Revenue</div><div class="kpi-value">${fmt(totalRevenue)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Cost</div><div class="kpi-value">${fmt(totalCost)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Profit</div><div class="kpi-value ${totalProfit >= 0 ? 'profit-pos' : 'profit-neg'}">${fmt(totalProfit)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Cards Profitable</div><div class="kpi-value">${profitPct}%</div></div>
    `;
  }

  const tbody = document.querySelector('#table-pnl tbody');
  if (tbody) {
    renderPnlRows(profitLoss);
  }

  // Time to sell table
  const ttsTbody = document.querySelector('#table-time-to-sell tbody');
  if (ttsTbody && timeToSell && timeToSell.length > 0) {
    renderTimeToSellRows(timeToSell);
  }
}

/* ─── Render Inventory page ────────────────────────────────────────────────── */
function renderInventory(inv) {
  if (!inv) return;

  const empty = document.getElementById('inventory-empty-state');
  const dash  = document.getElementById('inventory-dashboard');
  if (!inv || inv.length === 0) {
    if (empty) empty.style.display = '';
    if (dash)  dash.style.display  = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (dash)  dash.style.display  = '';

  const totalOnHand = inv.reduce((s, r) => s + (r.qty_on_hand || 0), 0);
  const totalValue  = inv.reduce((s, r) => s + (r.estimated_value || 0), 0);
  const unique      = inv.length;
  const avgBuy      = totalOnHand > 0 ? inv.reduce((s, r) => s + (r.avg_buy_price || 0) * (r.qty_on_hand || 0), 0) / totalOnHand : 0;

  const kpiGrid = document.getElementById('inventory-kpi-grid');
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Cards on Hand</div><div class="kpi-value">${totalOnHand}</div></div>
      <div class="kpi-card"><div class="kpi-label">Est. Portfolio Value</div><div class="kpi-value purple">${fmt(totalValue)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Unique Cards</div><div class="kpi-value">${unique}</div></div>
      <div class="kpi-card"><div class="kpi-label">Avg Buy Price</div><div class="kpi-value">${fmt(avgBuy)}</div></div>
    `;
  }

  renderInventoryRows(sortedInventory || inv);
}

/* ─── Render Repeat Buyers panel ──────────────────────────────────────────── */
function renderRepeatBuyers(rb) {
  const panel = document.getElementById('repeat-buyers-panel');
  if (!rb || !panel) return;
  panel.style.display = '';

  const kpis = document.getElementById('repeat-buyers-kpis');
  if (kpis) {
    kpis.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Unique Buyers</div><div class="kpi-value">${rb.total || 0}</div></div>
      <div class="kpi-card"><div class="kpi-label">Repeat Buyers</div><div class="kpi-value">${rb.repeatCount || 0}</div></div>
      <div class="kpi-card"><div class="kpi-label">Repeat Buyer %</div><div class="kpi-value">${rb.repeatPct != null ? rb.repeatPct.toFixed(1) + '%' : '—'}</div></div>
      <div class="kpi-card"><div class="kpi-label">Repeat Revenue %</div><div class="kpi-value">${rb.repeatRevenuePct != null ? rb.repeatRevenuePct.toFixed(1) + '%' : '—'}</div></div>
    `;
  }

  // Buyer distribution donut chart
  if (rb.distribution) {
    const dist = rb.distribution;
    const labels = Object.keys(dist);
    const vals   = Object.values(dist);
    doughnutChart('chart-buyer-distribution', labels, vals);
  }

  if (rb.buyers) { renderRepeatBuyersRows(rb.buyers); }
}

/* ─── Render Set ROI table ─────────────────────────────────────────────────── */
function renderSetROI(roi) {
  if (!roi) { return; }
  renderSetROIRows(roi);
}

/* ─── Render Foil Premium table ────────────────────────────────────────────── */
function renderFoilPremium(fp) {
  if (!fp) { return; }
  renderFoilPremiumRows(fp);
}

/* ─── Theme helpers ─────────────────────────────────────────────────────────── */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn1  = document.getElementById('btn-theme-toggle');
  const btn2  = document.getElementById('btn-toggle-theme');
  const label = theme === 'light' ? '🌙' : '☀';
  if (btn1) btn1.textContent = label;
  if (btn2) btn2.textContent = theme === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme';
}

(function setupTheme() {
  async function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    await window.mtg.setTheme(next);
  }
  document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('btn-toggle-theme')?.addEventListener('click', toggleTheme);
})();

/* ─── Drag-drop CSV import ──────────────────────────────────────────────────── */
(function setupDragDrop() {
  const overlay = document.getElementById('drag-overlay');
  document.addEventListener('dragover', e => {
    e.preventDefault();
    if (overlay) overlay.classList.add('active');
  });
  document.addEventListener('dragleave', e => {
    if (!e.relatedTarget && overlay) overlay.classList.remove('active');
  });
  document.addEventListener('drop', async e => {
    e.preventDefault();
    if (overlay) overlay.classList.remove('active');
    const files = Array.from(e.dataTransfer.files)
      .filter(f => f.name.toLowerCase().endsWith('.csv'))
      .map(f => f.path);
    if (!files.length) { toast('Drop CSV files to import'); return; }
    let totalInserted = 0;
    for (const fp of files) {
      const res = await window.mtg.importFile(fp).catch(() => null);
      if (res?.inserted) totalInserted += res.inserted;
    }
    toast(`Imported ${files.length} file(s) (+${totalInserted} orders)`);
    loadData();
    loadAnalyticsData();
  });
})();

/* ─── Date range presets ────────────────────────────────────────────────────── */
(function setupPresetBtns() {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const days = +btn.dataset.days;
      const to   = new Date();
      const from = days === 0 ? new Date(to.getFullYear(), 0, 1)
                              : new Date(Date.now() - days * 86_400_000);
      document.getElementById('filter-from').value = from.toISOString().split('T')[0];
      document.getElementById('filter-to').value   = to.toISOString().split('T')[0];
      loadData();
      loadPurchaseData();
      loadAnalyticsData();
    });
  });
})();

/* ─── Saved filter presets ──────────────────────────────────────────────────── */
async function refreshPresetSelect() {
  const presets = await window.mtg.getFilterPresets().catch(() => []);
  const sel = document.getElementById('preset-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">★ Presets</option>' +
    presets.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
}

(function setupFilterPresets() {
  document.getElementById('btn-save-preset')?.addEventListener('click', () => {
    const modal = document.getElementById('preset-modal');
    if (modal) { modal.classList.add('show'); document.getElementById('preset-name-input').value = ''; }
  });
  document.getElementById('btn-confirm-save-preset')?.addEventListener('click', async () => {
    const name = document.getElementById('preset-name-input')?.value.trim();
    if (!name) return;
    const from = document.getElementById('filter-from').value;
    const to   = document.getElementById('filter-to').value;
    await window.mtg.saveFilterPreset({ name, from, to });
    document.getElementById('preset-modal')?.classList.remove('show');
    await refreshPresetSelect();
    toast(`Preset saved: ${name}`);
  });
  document.getElementById('btn-cancel-save-preset')?.addEventListener('click', () => {
    document.getElementById('preset-modal')?.classList.remove('show');
  });
  document.getElementById('preset-select')?.addEventListener('change', async e => {
    const name = e.target.value;
    if (!name) return;
    const presets = await window.mtg.getFilterPresets().catch(() => []);
    const p = presets.find(x => x.name === name);
    if (p) {
      document.getElementById('filter-from').value = p.from || '';
      document.getElementById('filter-to').value   = p.to   || '';
      loadData();
      loadPurchaseData();
      loadAnalyticsData();
    }
  });
})();

/* ─── XLSX export handlers ──────────────────────────────────────────────────── */
(function setupXlsxExports() {
  async function xlsxExport(btnId, type, getRows) {
    document.getElementById(btnId)?.addEventListener('click', async () => {
      const rows = getRows();
      if (!rows || !rows.length) { toast('No data to export'); return; }
      const r = await window.mtg.exportXlsx({ type, rows });
      if (r?.ok) toast('Exported: ' + r.path.split(/[\\/]/).pop());
      else if (r?.error) toast('Export failed: ' + r.error);
    });
  }

  xlsxExport('btn-export-cards-xlsx',     'top-cards',    () => currentData?.topCards);
  xlsxExport('btn-export-orders-xlsx',    'orders',       () => currentData?.orders);
  xlsxExport('btn-export-purchases-xlsx', 'purchases',    () => purchaseData?.topCards);
  xlsxExport('btn-export-pnl-xlsx',       'pnl',          () => analyticsData?.profitLoss);
  xlsxExport('btn-export-inventory-xlsx', 'inventory',    () => analyticsData?.inventory);
})();

/* ─── Inventory search ──────────────────────────────────────────────────────── */
document.getElementById('inventory-search')?.addEventListener('input', () => {
  const base = sortedInventory || analyticsData?.inventory;
  if (base) { renderInventoryRows(base); }
});

/* ─── Auto-update UI ────────────────────────────────────────────────────────── */
(function setupAutoUpdate() {
  window.mtg.onUpdateAvailable?.(() => {
    const banner = document.getElementById('update-banner');
    if (banner) banner.style.display = 'flex';
    const st = document.getElementById('update-status');
    if (st) st.textContent = 'New version available — downloading…';
  });
  window.mtg.onUpdateDownloaded?.(() => {
    const st = document.getElementById('update-status');
    if (st) st.textContent = 'Update ready to install. Restart to apply.';
  });
  document.getElementById('btn-install-update')?.addEventListener('click', () => {
    window.mtg.installUpdate();
  });
  document.getElementById('btn-dismiss-update')?.addEventListener('click', () => {
    const banner = document.getElementById('update-banner');
    if (banner) banner.style.display = 'none';
  });
  document.getElementById('btn-check-update')?.addEventListener('click', async () => {
    const st = document.getElementById('update-status');
    if (st) st.textContent = 'Checking…';
    const r = await window.mtg.checkForUpdate();
    if (st) {
      st.textContent = r?.status === 'dev'       ? 'Running in development mode' :
                       r?.status === 'checking'  ? 'Check initiated…'            :
                       r?.status === 'unavailable'? 'Already up to date'         :
                       r?.status || 'Unknown status';
    }
  });

  // Show current version in settings
  const verEl = document.getElementById('app-version');
  if (verEl) window.mtg.getSettings().then(s => { if (s?.version) verEl.textContent = s.version; });
})();

/* ─── ManaBox inventory ─────────────────────────────────────────────────────── */
let manaboxItems = [];

async function loadManaboxInventory() {
  sortedManabox = null;
  stManabox?.reset();
  manaboxItems = await window.mtg.getInventoryList().catch(() => []);
  renderManaboxInventory(manaboxItems);
}

function renderManaboxInventory(items) {
  const emptyEl = document.getElementById('manabox-empty');
  const wrapEl  = document.getElementById('manabox-table-wrap');
  if (!items || items.length === 0) {
    if (emptyEl) { emptyEl.style.display = ''; }
    if (wrapEl)  { wrapEl.style.display  = 'none'; }
    return;
  }
  if (emptyEl) { emptyEl.style.display = 'none'; }
  if (wrapEl)  { wrapEl.style.display  = ''; }
  renderManaboxRows(sortedManabox || items);
}

document.getElementById('manabox-search')?.addEventListener('input', () => {
  renderManaboxRows(sortedManabox || manaboxItems);
});

document.getElementById('btn-import-inventory-inline')?.addEventListener('click', async () => {
  showLoading(true);
  const result = await window.mtg.importInventoryFile();
  showLoading(false);
  if (!result) { return; }
  toast(`Inventory imported: ${result.totalInserted} new, ${result.totalSkipped} existing`);
  await loadManaboxInventory();
});

document.getElementById('btn-export-manabox-xlsx')?.addEventListener('click', async () => {
  if (!manaboxItems.length) { toast('No inventory to export', 'error'); return; }
  const r = await window.mtg.exportXlsx({ type: 'inventory', rows: manaboxItems });
  if (r?.ok) toast('Exported: ' + r.path.split(/[\\/]/).pop());
});

/* ─── Scryfall card image tooltip ─────────────────────────────────────────── */
(function setupScryfallTooltip() {
  const tooltip        = document.getElementById('scryfall-tooltip');
  const tooltipImg     = document.getElementById('scryfall-tooltip-img');
  const tooltipSpinner = document.getElementById('scryfall-tooltip-spinner');
  if (!tooltip) return;

  const cache = new Map();
  let hoverTimer = null;

  function buildCdnUrl(scryfallId) {
    return `https://cards.scryfall.io/normal/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`;
  }

  async function getImageUrl(cardName, scryfallId) {
    const key = scryfallId || cardName;
    if (cache.has(key)) return cache.get(key);

    let url = null;
    if (scryfallId && scryfallId.length > 8) {
      url = buildCdnUrl(scryfallId);
    } else {
      try {
        const resp = await fetch(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
        );
        if (resp.ok) {
          const data = await resp.json();
          url = data.image_uris?.normal ||
                data.card_faces?.[0]?.image_uris?.normal ||
                null;
        }
      } catch { url = null; }
    }
    cache.set(key, url);
    return url;
  }

  function positionTooltip(e) {
    const margin = 14;
    const tw = tooltip.offsetWidth  || 252;
    const th = tooltip.offsetHeight || 346;
    let x = e.clientX + margin;
    let y = e.clientY + margin;
    if (x + tw > window.innerWidth)  x = e.clientX - tw - margin;
    if (y + th > window.innerHeight) y = e.clientY - th - margin;
    tooltip.style.left = x + 'px';
    tooltip.style.top  = y + 'px';
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
    tooltipImg.src         = '';
    tooltipImg.style.display    = 'none';
    tooltipSpinner.style.display = '';
  }

  document.addEventListener('mouseover', async e => {
    const el = e.target.closest('[data-card-name]');
    if (!el) return;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(async () => {
      const cardName   = el.dataset.cardName;
      const scryfallId = el.dataset.scryfallId || '';
      if (!cardName) return;

      tooltipImg.style.display     = 'none';
      tooltipSpinner.style.display = '';
      tooltip.style.display        = 'block';
      positionTooltip(e);

      const url = await getImageUrl(cardName, scryfallId);
      if (!url) { hideTooltip(); return; }

      tooltipImg.src    = url;
      tooltipImg.onload = () => {
        tooltipSpinner.style.display = 'none';
        tooltipImg.style.display     = 'block';
      };
      tooltipImg.onerror = () => hideTooltip();
    }, 300);
  });

  document.addEventListener('mousemove', e => {
    if (tooltip.style.display !== 'none') positionTooltip(e);
  });

  document.addEventListener('mouseout', e => {
    if (e.target.closest('[data-card-name]') && !e.relatedTarget?.closest('[data-card-name]')) {
      clearTimeout(hoverTimer);
      setTimeout(hideTooltip, 80);
    }
  });
})();
