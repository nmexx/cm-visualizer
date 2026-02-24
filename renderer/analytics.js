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
  state.sortedInventory = inv.items;
  renderInventoryRows(inv.items);

  const el = document.getElementById('inventory-count');
  if (el) { el.textContent = `${fmtNum(inv.items.length)} cards · ${fmt(inv.totalValue)} total value`; }

  // Bind search once (use .replaceWith to avoid stacking listeners)
  const searchEl = document.getElementById('inventory-search');
  if (searchEl) {
    const newSearch = searchEl.cloneNode(true);
    searchEl.parentNode.replaceChild(newSearch, searchEl);
    newSearch.addEventListener('input', () => {
      const q = newSearch.value.toLowerCase().trim();
      const filtered = (state.sortedInventory || []).filter(item =>
        !q || item.card_name?.toLowerCase().includes(q) || item.set_name?.toLowerCase().includes(q)
      );
      renderInventoryRows(filtered);
    });
  }
}

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
  const r = await window.mtg.exportXlsx('pnl');
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
document.getElementById('btn-export-inventory').addEventListener('click', async () => {
  const r = await window.mtg.exportXlsx('inventory');
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
