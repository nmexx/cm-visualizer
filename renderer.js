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
let charts       = {};
let currentData  = null;
let purchaseData = null;
let filters      = {};
let orderPage    = 1;
const PAGE_SIZE  = 50;

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
  const totalCardRev = (d.topCards || []).reduce((a, b) => a + (b.revenue || 0), 0);
  document.querySelector('#table-top-cards tbody').innerHTML = (d.topCards || []).map((c, i) => `
    <tr>
      <td class="dim">${i + 1}</td>
      <td>${c.card_name}</td>
      <td class="dim">${c.set_name}</td>
      <td>${rarityBadge(c.rarity)}</td>
      <td class="mono">${fmtNum(c.qty_sold)}</td>
      <td class="mono gold">${fmt(c.revenue)}</td>
      <td class="mono dim">${totalCardRev > 0 ? (c.revenue / totalCardRev * 100).toFixed(1) + '%' : '-'}</td>
    </tr>`).join('');

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

  const totalSetRev = (d.bySet || []).reduce((a, b) => a + (b.revenue || 0), 0);
  document.querySelector('#table-sets tbody').innerHTML = (d.bySet || []).map(s => `
    <tr>
      <td>${s.set_name}</td>
      <td class="mono">${fmtNum(s.qty)}</td>
      <td class="mono gold">${fmt(s.revenue)}</td>
      <td class="mono dim">${totalSetRev > 0 ? (s.revenue / totalSetRev * 100).toFixed(1) + '%' : '-'}</td>
    </tr>`).join('');
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
  if (currentData) { renderOrdersPage(currentData.allOrders || []); }
});
document.getElementById('orders-prev').addEventListener('click', () => {
  orderPage--;
  if (currentData) { renderOrdersPage(currentData.allOrders || []); }
});
document.getElementById('orders-next').addEventListener('click', () => {
  orderPage++;
  if (currentData) { renderOrdersPage(currentData.allOrders || []); }
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
  document.querySelector('#table-bought-cards tbody').innerHTML = (d.topBoughtCards || []).map((c, i) => `
    <tr>
      <td class="dim">${i + 1}</td>
      <td>${c.card_name}</td>
      <td class="dim">${c.set_name}</td>
      <td>${rarityBadge(c.rarity)}</td>
      <td class="mono">${fmtNum(c.qty_bought)}</td>
      <td class="mono red">${fmt(c.spent)}</td>
      <td class="dim">${c.in_orders}</td>
    </tr>`).join('');

  /* Purchases table */
  document.querySelector('#table-purchases tbody').innerHTML = (d.allPurchases || []).map(o => `
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
  const f    = buildFilters();
  const data = await window.mtg.getStats(f);
  renderDashboard(data);
}

async function loadPurchaseData() {
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
  const folder   = settings.csv_folder;
  if (!folder) { toast('No folder configured — go to Settings first', 'error'); return; }
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

/* ─── Filter buttons ──────────────────────────────────────────────────────── */
document.getElementById('btn-apply-filter').addEventListener('click', () => {
  loadData();
  loadPurchaseData();
});
document.getElementById('btn-clear-filter').addEventListener('click', () => {
  document.getElementById('filter-from').value = '';
  document.getElementById('filter-to').value   = '';
  loadData();
  loadPurchaseData();
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
document.getElementById('btn-set-folder').addEventListener('click', async () => {
  const folder = await window.mtg.selectFolder();
  if (!folder) { return; }
  document.getElementById('setting-folder').textContent = folder;
  showLoading(true);
  const result = await window.mtg.importFolder(folder);
  showLoading(false);
  if (result.error) { toast(result.error, 'error'); return; }
  toast(`Folder set. Imported ${result.totalInserted} orders.`);
  loadData();
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
});

/* ─── Init ─────────────────────────────────────────────────────────────────── */
async function init() {
  const [settings, dbPath] = await Promise.all([
    window.mtg.getSettings(),
    window.mtg.getDbPath()
  ]);

  if (settings.csv_folder) {
    document.getElementById('setting-folder').textContent = settings.csv_folder;
  }
  document.getElementById('setting-db-path').textContent = dbPath || '';
  document.getElementById('db-path-status').textContent  = dbPath ? dbPath.split(/[\\/]/).pop() : '';

  await Promise.all([loadData(), loadPurchaseData()]);
}

init();
