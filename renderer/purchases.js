/**
 * Purchases (Bought Orders) dashboard — data loading, rendering and event handlers.
 */
import { state } from './state.js';
import { fmt, fmtNum, buildFilters, renderMissingMonths, trendHtml, toast, showLoading } from './utils.js';
import { lineChart, barChart, doughnutChart, hbarChart } from './charts.js';
import { renderBoughtCardsRows, renderPurchasesRows, stBoughtCards, stPurchases } from './tables.js';

/* ─── Load & render ──────────────────────────────────────────────────────── */

export async function loadPurchaseData() {
  // Clear any previous selections when reloading data
  state.selectedBoughtCards.clear();
  stBoughtCards?.reset(); stPurchases?.reset();
  const data = await window.mtg.getPurchaseStats(buildFilters('purchased'));
  renderPurchases(data);
}

export function renderPurchases(d) {
  state.purchaseData = d;
  const s       = d.summary || {};
  const hasData = (s.total_purchases || 0) > 0;

  document.getElementById('purchase-empty-state').style.display    = hasData ? 'none'  : 'flex';
  document.getElementById('purchase-dashboard').style.display      = hasData ? 'block' : 'none';
  if (!hasData) { return; }

  renderMissingMonths(d.missingMonths, 'missing-months-purchases');
  const p        = d.prevSummary || {};
  const cardCost = s.avg_card_cost != null ? fmt(s.avg_card_cost) : '–';
  const kpis = [
    { label: 'Total Spent',      value: fmt(s.total_spent),       cls: 'gold',  trend: trendHtml(s.total_spent,      p.total_spent) },
    { label: 'Purchases',        value: fmtNum(s.total_purchases), cls: '',      trend: trendHtml(s.total_purchases,  p.total_purchases) },
    { label: 'Cards Bought',     value: fmtNum(s.total_cards),    cls: '',      trend: trendHtml(s.total_cards,      p.total_cards) },
    { label: 'Unique Sellers',   value: fmtNum(s.unique_sellers), cls: 'blue',  trend: '' },
    { label: 'Avg Purchase',     value: fmt(s.avg_purchase_value),cls: '',      trend: '' },
    { label: 'Avg Card Cost',    value: cardCost,                  cls: '',      trend: '' },
  ];
  document.getElementById('purchase-kpi-grid').innerHTML = kpis.map(k =>
    `<div class="kpi"><div class="kpi-label">${k.label}</div><div class="kpi-value ${k.cls}">${k.value}</div>${k.trend || ''}</div>`
  ).join('');

  if (d.spendByDay?.length) {
    lineChart('chart-spend-time', d.spendByDay.map(r => r.day), d.spendByDay.map(r => r.amount_spent));
  }
  if (d.spendByMonth?.length) {
    barChart('chart-spend-monthly', d.spendByMonth.map(r => r.month), [{
      label: 'Amount Spent',
      data: d.spendByMonth.map(r => r.amount_spent),
      backgroundColor: '#c9a22799', borderColor: '#c9a227', borderWidth: 1,
    }], { legend: { display: false } });
  }
  const foilP   = d.foilVsNormal?.find(r =>  r.is_foil) || {};
  const normalP = d.foilVsNormal?.find(r => !r.is_foil) || {};
  doughnutChart('chart-foil-purchases', ['Foil', 'Normal'], [foilP.amount_spent || 0, normalP.amount_spent || 0], ['#7ecfdd', '#3d3d5a']);
  if (d.byCountry?.length) {
    hbarChart('chart-purchase-countries', d.byCountry.slice(0, 8).map(r => r.country), d.byCountry.slice(0, 8).map(r => r.amount_spent), '#3d8ef0');
  }
  if (d.bySeller?.length) {
    hbarChart('chart-top-sellers', d.bySeller.slice(0, 8).map(r => r.seller_name?.substring(0, 24) || 'Unknown'), d.bySeller.slice(0, 8).map(r => r.amount_spent), '#9b59b6');
  }
  if (d.byRarity?.length) {
    doughnutChart('chart-purchase-rarity',
      d.byRarity.map(r => r.rarity),
      d.byRarity.map(r => r.amount_spent),
      ['#e8752a', '#c9a227', '#aab8c8', '#9aa0a8', '#3d8ef0']);
  }
  renderBoughtCardsRows(d.topBoughtCards || []);
  renderPurchasesRows(d.allPurchases || []);
}

/* ─── Import / export button handlers ───────────────────────────────────── */

document.getElementById('btn-import-purchases').addEventListener('click', async () => {
  const settings = await window.mtg.getSettings();
  const folder   = settings.csv_folder_purchased || settings.csv_folder;
  if (!folder) { toast('No purchased folder configured — go to Settings first', 'error'); return; }
  showLoading(true);
  const result = await window.mtg.importPurchaseFolder(folder);
  showLoading(false);
  if (result?.error) { toast(result.error, 'error'); return; }
  toast(`Synced: ${result.totalInserted} new, ${result.totalSkipped} existing`);
  loadPurchaseData();
});

document.getElementById('btn-export-purchases').addEventListener('click', async () => {
  const r = await window.mtg.exportCsv('purchases');
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
document.getElementById('btn-export-purchases-xlsx').addEventListener('click', async () => {
  const r = await window.mtg.exportXlsx({ type: 'purchases', rows: state.purchaseData?.allPurchases || [] });
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});

/* ─── Bulk exclusion from P&L ─────────────────────────────────────────────── */

// Check all checkbox
document.getElementById('bought-cards-check-all').addEventListener('change', (e) => {
  const checkboxes = document.querySelectorAll('.bought-card-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = e.target.checked;
    const cardKey = cb.getAttribute('data-card-key');
    if (e.target.checked) {
      state.selectedBoughtCards.add(cardKey);
    } else {
      state.selectedBoughtCards.delete(cardKey);
    }
  });
  // Update element that displays count (defined in tables.js)
  const countEl = document.getElementById('selected-cards-count');
  if (countEl) {
    const count = state.selectedBoughtCards.size;
    countEl.textContent = count > 0 ? `${count} card${count !== 1 ? 's' : ''} selected` : '';
  }
});

// Exclude selected cards button
document.getElementById('btn-exclude-selected-cards').addEventListener('click', async () => {
  if (state.selectedBoughtCards.size === 0) {
    toast('No cards selected', 'info');
    return;
  }
  
  showLoading(true);
  let successCount = 0;
  let failCount = 0;
  
  // Exclude each selected card
  for (const cardKey of state.selectedBoughtCards) {
    const parts = cardKey.split('||');
    const cardName = parts[0];
    const setName = parts[1];
    
    const result = await window.mtg.setPurchaseItemsExcludeFromPL({
      card_name: cardName,
      set_name: setName,
      exclude: true
    });
    
    if (result?.ok) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  showLoading(false);
  
  if (successCount > 0) {
    state.selectedBoughtCards.clear();
    toast(`Excluded ${successCount} card${successCount !== 1 ? 's' : ''} from P&L analytics`, 'success');
    // Reload purchases and analytics data
    loadPurchaseData();
    // Also reload analytics to show the updated P&L
    const { loadAnalyticsData } = await import('./analytics.js');
    loadAnalyticsData();
  }
  if (failCount > 0) {
    toast(`Failed to exclude ${failCount} card${failCount !== 1 ? 's' : ''}`, 'error');
  }
});

/* ─── Bought cards pagination & search ───────────────────────────────────── */

document.getElementById('bought-cards-search').addEventListener('input', () => {
  state.boughtCardsPage = 1;
  if (state.purchaseData) { renderBoughtCardsPage(state.boughtCardsDisplayBase || state.purchaseData.topBoughtCards || []); }
});
document.getElementById('bought-cards-prev').addEventListener('click', () => {
  state.boughtCardsPage--;
  if (state.purchaseData) { renderBoughtCardsPage(state.boughtCardsDisplayBase || state.purchaseData.topBoughtCards || []); }
});
document.getElementById('bought-cards-next').addEventListener('click', () => {
  state.boughtCardsPage++;
  if (state.purchaseData) { renderBoughtCardsPage(state.boughtCardsDisplayBase || state.purchaseData.topBoughtCards || []); }
});

function renderBoughtCardsPage(cards) {
  renderBoughtCardsRows(cards);
}
