/**
 * Analytics dashboard — inventory P&L, repeat buyers, set ROI, foil premium.
 */
import { state } from './state.js';
import { fmt, fmtNum, esc, buildFilters, toast, showLoading } from './utils.js';
import { barChart } from './charts.js';
import {
  renderPnlRows, renderTimeToSellRows, renderInventoryRows,
  renderRepeatBuyersRows, renderSetROIRows, renderFoilPremiumRows,
  stPnl, stTimeToSell, stInventory, stRepeatBuyers, stSetROI, stFoilPremium,
} from './tables.js';

/* ─── Load & render ──────────────────────────────────────────────────────── */

export async function loadAnalyticsData() {
  stPnl?.reset(); stTimeToSell?.reset(); stInventory?.reset();
  stRepeatBuyers?.reset(); stSetROI?.reset(); stFoilPremium?.reset();
  const data = await window.mtg.getAnalytics(buildFilters());
  renderAnalytics(data);
}

export function renderAnalytics(d) {
  state.analyticsData = d;

  renderPnlRows(d.pnl || []);
  renderTimeToSellRows(d.timeToSell || []);
  renderRepeatBuyers(d.repeatBuyers || []);
  renderSetROI(d.setROI || []);
  renderFoilPremium(d.foilPremium || []);
  if (d.inventory != null) { renderInventory(d.inventory); }

  if (d.revenueVsCostByMonth?.length) {
    barChart('chart-pnl-monthly', d.revenueVsCostByMonth.map(r => r.month), [
      { label: 'Revenue',    data: d.revenueVsCostByMonth.map(r => r.revenue),   backgroundColor: '#2ecc7199', borderColor: '#2ecc71', borderWidth: 1 },
      { label: 'Cost',       data: d.revenueVsCostByMonth.map(r => r.cost),      backgroundColor: '#e74c3c66', borderColor: '#e74c3c', borderWidth: 1 },
    ], { legend: { display: true, labels: { color: '#6b7a94' } } });
  }
}

export function renderRepeatBuyers(rb) {
  renderRepeatBuyersRows(rb);
}

export function renderSetROI(roi) {
  renderSetROIRows(roi);
}

export function renderFoilPremium(fp) {
  renderFoilPremiumRows(fp);
}

export function renderInventory(inv) {
  if (!inv || !inv.items) { return; }
  const hasData = inv.items.length > 0;
  const emptyEl = document.getElementById('inventory-empty-state');
  const dashEl  = document.getElementById('inventory-dashboard');
  if (emptyEl) emptyEl.style.display = hasData ? 'none'  : 'flex';
  if (dashEl)  dashEl.style.display  = hasData ? 'block' : 'none';
  if (!hasData) { return; }

  state.sortedInventory = inv.items;
  renderInventoryRows(inv.items);

  const el = document.getElementById('inventory-count');
  if (el) { el.textContent = `${fmtNum(inv.items.length)} cards · ${fmt(inv.totalValue)} total value`; }

  // KPI grid
  const kpiEl = document.getElementById('inventory-kpi-grid');
  if (kpiEl) {
    const totalQty  = inv.items.reduce((s, r) => s + (r.qty_on_hand  || 0), 0);
    const totalCost = inv.items.reduce((s, r) => s + (r.total_cost   || 0), 0);
    const mktValue  = inv.items.reduce((s, r) => s + (r.market_value || 0), 0);
    const kpis = [
      { label: 'Unique Cards',  value: fmtNum(inv.items.length), cls: '' },
      { label: 'Total on Hand', value: fmtNum(totalQty),         cls: '' },
      { label: 'Total Cost',    value: fmt(totalCost),            cls: 'red' },
      { label: 'Est. Value',    value: fmt(inv.totalValue),       cls: 'gold' },
      { label: 'Mkt Value',     value: mktValue > 0 ? fmt(mktValue) : '—', cls: mktValue > 0 ? 'gold' : '' },
    ];
    kpiEl.innerHTML = kpis.map(k =>
      `<div class="kpi"><div class="kpi-label">${k.label}</div><div class="kpi-value ${k.cls}">${k.value}</div></div>`
    ).join('');
  }

}

// Static inventory search — reads from state.sortedInventory set by renderInventory
document.getElementById('inventory-search')?.addEventListener('input', () => {
  const q = document.getElementById('inventory-search').value.toLowerCase().trim();
  const filtered = (state.sortedInventory || []).filter(item =>
    !q || item.card_name?.toLowerCase().includes(q) || item.set_name?.toLowerCase().includes(q)
  );
  renderInventoryRows(filtered);
});

/* ─── Import / export button handlers ───────────────────────────────────── */

document.getElementById('btn-import-inventory').addEventListener('click', async () => {
  const settings = await window.mtg.getSettings();
  if (!settings.inventory_file_path) { toast('No inventory file configured — go to Settings first', 'error'); return; }
  showLoading(true);
  const result = await window.mtg.importInventoryFile(settings.inventory_file_path);
  showLoading(false);
  if (result?.error) { toast(result.error, 'error'); return; }
  toast(`Inventory loaded: ${fmtNum(result.count)} items`);
  loadAnalyticsData();
});

document.getElementById('btn-export-pnl').addEventListener('click', async () => {
  const r = await window.mtg.exportCsv({ type: 'pnl', rows: state.analyticsData?.pnl || [] });
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
document.getElementById('btn-export-pnl-xlsx').addEventListener('click', async () => {
  const r = await window.mtg.exportXlsx({ type: 'pnl', rows: state.analyticsData?.pnl || [] });
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
document.getElementById('btn-export-inventory').addEventListener('click', async () => {
  const rows = state.sortedInventory || state.analyticsData?.inventory?.items || [];
  const r = await window.mtg.exportCsv({ type: 'inventory', rows });
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
document.getElementById('btn-export-inventory-xlsx').addEventListener('click', async () => {
  const rows = state.sortedInventory || state.analyticsData?.inventory?.items || [];
  const r = await window.mtg.exportXlsx({ type: 'inventory', rows });
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
