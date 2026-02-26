/**
 * Sales (Sold Orders) dashboard — data loading, rendering and event handlers.
 */
import { state } from './state.js';
import { fmt, fmtNum, buildFilters, renderMissingMonths, trendHtml, toast, showLoading } from './utils.js';
import { lineChart, barChart, hbarChart, doughnutChart } from './charts.js';
import {
  renderTopCardsRows, renderSetsRows, renderOrdersRows, renderRepeatBuyersRows,
  stTopCards, stSets, stOrders,
} from './tables.js';

/* ─── Load & render ──────────────────────────────────────────────────────── */

export async function loadData() {
  state.ordersDisplayBase = null;
  stTopCards?.reset(); stSets?.reset(); stOrders?.reset();
  const filters = buildFilters();
  const [data, purchaseData] = await Promise.all([
    window.mtg.getStats(filters),
    window.mtg.getPurchaseStats(filters),
  ]);
  renderDashboard(data, purchaseData);
}

export function renderDashboard(d, purchaseData) {
  state.currentData = d;
  const s       = d.summary || {};
  const hasData = (s.total_orders || 0) > 0;

  document.getElementById('empty-state').style.display          = hasData ? 'none'  : 'flex';
  document.getElementById('dashboard-content').style.display    = hasData ? 'block' : 'none';
  if (!hasData) { return; }

  document.getElementById('status-orders').textContent  = fmtNum(s.total_orders)  + ' orders';
  document.getElementById('status-revenue').textContent = fmt(s.total_revenue)     + ' revenue';

  renderMissingMonths(d.missingMonths, 'missing-months-sales');

  const netRevenue   = (s.total_revenue || 0) - (s.total_commission || 0) - (s.total_shipping || 0);
  const commRate     = s.total_revenue > 0 ? ((s.total_commission / s.total_revenue) * 100).toFixed(1) + '%' : '0%';
  const shippingRate = s.total_revenue > 0 ? ((s.total_shipping / s.total_revenue) * 100).toFixed(1) + '%' : '0%';
  const p            = d.prevSummary || {};
  const prevNet      = (p.total_revenue || 0) - (p.total_commission || 0) - (p.total_shipping || 0);

  const kpis = [
    { label: 'Total Revenue',   value: fmt(s.total_revenue),    cls: 'gold',  trend: trendHtml(s.total_revenue,    p.total_revenue) },
    { label: 'Net Revenue',     value: fmt(netRevenue),          cls: 'green', trend: trendHtml(netRevenue,         prevNet) },
    { label: 'Orders',          value: fmtNum(s.total_orders),  cls: '',      trend: trendHtml(s.total_orders,     p.total_orders) },
    { label: 'Unique Buyers',   value: fmtNum(s.unique_buyers), cls: 'blue',  trend: '' },
    { label: 'Cards Sold',      value: fmtNum(s.total_articles),cls: '',      trend: trendHtml(s.total_articles,   p.total_articles) },
    { label: 'Avg Order Value', value: fmt(s.avg_order_value),  cls: '',      trend: '' },
    { label: 'Total Shipping',  value: fmt(s.total_shipping),   cls: '',      trend: '' },
    { label: 'Shipping Rate',   value: shippingRate,             cls: '',      trend: '' },
    { label: 'Commission Rate', value: commRate,                 cls: '',      trend: '' },
    { label: 'Commission Paid', value: fmt(s.total_commission), cls: '',      trend: '' },
  ];
  document.getElementById('kpi-grid').innerHTML = kpis.map(k =>
    `<div class="kpi"><div class="kpi-label">${k.label}</div><div class="kpi-value ${k.cls}">${k.value}</div>${k.trend || ''}</div>`
  ).join('');

  const purchaseKpiEl = document.getElementById('overview-purchase-kpis');
  if (purchaseKpiEl) {
    const ps = purchaseData?.summary || {};
    if ((ps.total_purchases || 0) > 0) {
      const pp = purchaseData?.prevSummary || {};
      const cardCost = ps.avg_card_cost != null ? fmt(ps.avg_card_cost) : '–';
      const purchaseKpis = [
        { label: 'Total Spent',    value: fmt(ps.total_spent),        cls: 'gold', trend: trendHtml(ps.total_spent,     pp.total_spent) },
        { label: 'Purchases',      value: fmtNum(ps.total_purchases), cls: '',     trend: trendHtml(ps.total_purchases, pp.total_purchases) },
        { label: 'Cards Bought',   value: fmtNum(ps.total_cards),     cls: '',     trend: trendHtml(ps.total_cards,     pp.total_cards) },
        { label: 'Unique Sellers', value: fmtNum(ps.unique_sellers),  cls: 'blue', trend: '' },
        { label: 'Avg Purchase',   value: fmt(ps.avg_purchase_value), cls: '',     trend: '' },
        { label: 'Avg Card Cost',  value: cardCost,                   cls: '',     trend: '' },
      ];
      purchaseKpiEl.innerHTML = purchaseKpis.map(k =>
        `<div class="kpi"><div class="kpi-label">${k.label}</div><div class="kpi-value ${k.cls}">${k.value}</div>${k.trend || ''}</div>`
      ).join('');
    } else {
      purchaseKpiEl.innerHTML = '<div class="dim" style="font-size:12px">No purchase data yet.</div>';
    }
  }

  if (d.revenueByDay?.length) {
    lineChart('chart-revenue-time', d.revenueByDay.map(r => r.day), d.revenueByDay.map(r => r.revenue));
  }
  if (d.profitByMonth?.length) {
    barChart('chart-monthly', d.profitByMonth.map(r => r.month), [
      { label: 'Revenue',    data: d.profitByMonth.map(r => r.revenue),    backgroundColor: '#c9a22799', borderColor: '#c9a227', borderWidth: 1 },
      { label: 'Commission', data: d.profitByMonth.map(r => r.commission), backgroundColor: '#e74c3c66', borderColor: '#e74c3c', borderWidth: 1 },
    ], { legend: { display: true, labels: { color: '#6b7a94' } } });
  }
  if (d.revenueByCountry?.length) {
    hbarChart('chart-countries', d.revenueByCountry.slice(0, 8).map(r => r.country), d.revenueByCountry.slice(0, 8).map(r => r.revenue), '#3d8ef0');
  }

  const foil   = d.foilVsNormal?.find(r =>  r.is_foil) || {};
  const normal = d.foilVsNormal?.find(r => !r.is_foil) || {};
  doughnutChart('chart-foil',   ['Foil', 'Normal'],   [foil.revenue || 0, normal.revenue || 0], ['#7ecfdd', '#3d3d5a']);
  if (d.byRarity?.length) {
    doughnutChart('chart-rarity', d.byRarity.map(r => r.rarity), d.byRarity.map(r => r.revenue),
      ['#e8752a', '#c9a227', '#aab8c8', '#9aa0a8', '#3d8ef0']);
  }

  /* ──── PURCHASE GRAPHS ──── */
  if (purchaseData?.spendByDay?.length) {
    lineChart('chart-purchase-time', purchaseData.spendByDay.map(r => r.day), purchaseData.spendByDay.map(r => r.amount_spent));
  }
  if (purchaseData?.spendByMonth?.length) {
    barChart('chart-purchase-monthly', purchaseData.spendByMonth.map(r => r.month), [
      { label: 'Spent',  data: purchaseData.spendByMonth.map(r => r.amount_spent), backgroundColor: '#3d8ef099', borderColor: '#3d8ef0', borderWidth: 1 },
      { label: 'Fees',   data: purchaseData.spendByMonth.map(r => r.fees || 0),     backgroundColor: '#e74c3c66', borderColor: '#e74c3c', borderWidth: 1 },
    ], { legend: { display: true, labels: { color: '#6b7a94' } } });
  }
  if (purchaseData?.bySeller?.length) {
    hbarChart('chart-purchase-sellers', purchaseData.bySeller.slice(0, 8).map(r => r.seller_name || r.seller_username), purchaseData.bySeller.slice(0, 8).map(r => r.amount_spent), '#c9a227');
  }

  const purchaseFoil   = purchaseData?.foilVsNormal?.find(r =>  r.is_foil) || {};
  const purchaseNormal = purchaseData?.foilVsNormal?.find(r => !r.is_foil) || {};
  doughnutChart('chart-purchase-foil', ['Foil', 'Normal'], [purchaseFoil.amount_spent || 0, purchaseNormal.amount_spent || 0], ['#7ecfdd', '#3d3d5a']);
  if (purchaseData?.byRarity?.length) {
    doughnutChart('chart-purchase-rarity', purchaseData.byRarity.map(r => r.rarity), purchaseData.byRarity.map(r => r.amount_spent),
      ['#e8752a', '#c9a227', '#aab8c8', '#9aa0a8', '#3d8ef0']);
  }

  if (d.byLanguage?.length) {
    hbarChart('chart-language', d.byLanguage.map(r => r.language), d.byLanguage.map(r => r.revenue), '#9b59b6');
  }
  if (d.byRarity?.length) {
    barChart('chart-rarity2', d.byRarity.map(r => r.rarity), [{
      data: d.byRarity.map(r => r.revenue),
      backgroundColor: ['#e8752a99','#c9a22799','#aab8c899','#9aa0a899','#3d8ef099'],
      borderColor: ['#e8752a','#c9a227','#aab8c8','#9aa0a8','#3d8ef0'], borderWidth: 1,
    }]);
  }
  if (d.byCondition?.length) {
    const GOLD_PALETTE = ['#c9a227','#e8c547','#9b7b1e','#3d8ef0','#2ecc71','#9b59b6','#e74c3c','#7ecfdd','#e8752a','#6b7a94'];
    doughnutChart('chart-condition', d.byCondition.map(r => r.condition), d.byCondition.map(r => r.qty), GOLD_PALETTE);
  }
  if (d.bySet?.length) {
    hbarChart('chart-sets',
      d.bySet.slice(0, 10).map(r => r.set_name?.length > 28 ? r.set_name.substring(0, 28) + '…' : r.set_name),
      d.bySet.slice(0, 10).map(r => r.revenue), '#2ecc71');
    lineChart('chart-monthly2', d.profitByMonth?.map(r => r.month) || [], d.profitByMonth?.map(r => r.revenue) || []);
    renderSetsRows(d.bySet);
  }
  renderTopCardsRows(d.topCards || []);

  state.orderPage = 1;
  renderOrdersPage(d.allOrders || []);

  // Repeat Buyers panel (in the Orders page)
  const rb         = d.repeatBuyers;
  const repeatPanel = document.getElementById('repeat-buyers-panel');
  if (repeatPanel) {
    if (rb?.total > 0) {
      repeatPanel.style.display = 'block';
      document.getElementById('repeat-buyers-kpis').innerHTML = [
        { label: 'Total Buyers',        value: fmtNum(rb.total) },
        { label: 'Repeat Buyers',       value: fmtNum(rb.repeatCount) },
        { label: 'Repeat Rate',         value: rb.repeatPct.toFixed(1) + '%' },
        { label: 'Revenue from Repeats', value: rb.repeatRevenuePct.toFixed(1) + '%' },
      ].map(k => `<div class="kpi"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div></div>`).join('');
      const dist = rb.distribution || {};
      doughnutChart('chart-buyer-distribution',
        ['1 order', '2 orders', '3 orders', '4+ orders'],
        [dist.once || 0, dist.twice || 0, dist.thrice || 0, dist.more || 0],
        ['#6b7a94', '#3d8ef0', '#c9a227', '#2ecc71']);
      renderRepeatBuyersRows(rb.topRepeats || []);
    } else {
      repeatPanel.style.display = 'none';
    }
  }
}

/* ─── Orders pagination ──────────────────────────────────────────────────── */

export function renderOrdersPage(orders) {
  renderOrdersRows(orders);
  // Row click → buyer modal
  document.querySelectorAll('#table-orders tbody tr').forEach(row => {
    row.addEventListener('click', () => {
      const username = row.dataset.username;
      if (username && state.currentData?.allOrders) {
        showBuyerModal(username, state.currentData.allOrders);
      }
    });
  });
}
/* ─── Top cards search & pagination ───────────────────────────────────── */

document.getElementById('top-cards-search').addEventListener('input', () => {
  state.topCardsPage = 1;
  if (state.currentData) { renderTopCardsPage(state.topCardsDisplayBase || state.currentData.topCards || []); }
});
document.getElementById('top-cards-prev').addEventListener('click', () => {
  state.topCardsPage--;
  if (state.currentData) { renderTopCardsPage(state.topCardsDisplayBase || state.currentData.topCards || []); }
});
document.getElementById('top-cards-next').addEventListener('click', () => {
  state.topCardsPage++;
  if (state.currentData) { renderTopCardsPage(state.topCardsDisplayBase || state.currentData.topCards || []); }
});

function renderTopCardsPage(cards) {
  renderTopCardsRows(cards);
}

/* ─── Buyer detail modal ─────────────────────────────────────────────────── */

function showBuyerModal(username, allOrders) {
  const orders    = allOrders.filter(o => o.username === username);
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
document.getElementById('orders-search').addEventListener('input', () => {
  state.orderPage = 1;
  if (state.currentData) { renderOrdersPage(state.ordersDisplayBase || state.currentData.allOrders || []); }
});
document.getElementById('orders-prev').addEventListener('click', () => {
  state.orderPage--;
  if (state.currentData) { renderOrdersPage(state.ordersDisplayBase || state.currentData.allOrders || []); }
});
document.getElementById('orders-next').addEventListener('click', () => {
  state.orderPage++;
  if (state.currentData) { renderOrdersPage(state.ordersDisplayBase || state.currentData.allOrders || []); }
});

/* ─── Import / export button handlers ───────────────────────────────────── */

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

document.getElementById('btn-export-orders').addEventListener('click', async () => {
  const r = await window.mtg.exportCsv('orders');
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
document.getElementById('btn-export-orders-xlsx').addEventListener('click', async () => {
  const r = await window.mtg.exportXlsx({ type: 'orders', rows: state.currentData?.allOrders || [] });
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
document.getElementById('btn-export-cards').addEventListener('click', async () => {
  const r = await window.mtg.exportCsv('top-cards');
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
document.getElementById('btn-export-cards-xlsx').addEventListener('click', async () => {
  const r = await window.mtg.exportXlsx({ type: 'cards', rows: state.currentData?.topCards || [] });
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
