/**
 * Saved filter presets — save, load, and delete date-range presets.
 */
import { esc } from '../utils.js';
import { loadData } from '../sales.js';
import { loadPurchaseData } from '../purchases.js';
import { loadAnalyticsData } from '../analytics.js';

export async function refreshPresetSelect() {
  const presets = await window.mtg.getFilterPresets().catch(() => []);
  const sel = document.getElementById('preset-select');
  if (!sel) { return; }
  sel.innerHTML = '<option value="">★ Presets</option>' +
    presets.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
}

document.getElementById('btn-save-preset')?.addEventListener('click', () => {
  const modal = document.getElementById('preset-modal');
  if (modal) { modal.classList.add('show'); document.getElementById('preset-name-input').value = ''; }
});

document.getElementById('btn-confirm-save-preset')?.addEventListener('click', async () => {
  const name = document.getElementById('preset-name-input')?.value.trim();
  if (!name) { return; }
  const from = document.getElementById('filter-from').value;
  const to   = document.getElementById('filter-to').value;
  await window.mtg.saveFilterPreset({ name, from, to });
  document.getElementById('preset-modal')?.classList.remove('show');
  await refreshPresetSelect();
  // small toast helper is importable but also on window; use direct approach
  const toastEl = document.createElement('div');
  toastEl.className = 'toast'; toastEl.textContent = `Preset saved: ${name}`;
  document.body.appendChild(toastEl);
  setTimeout(() => toastEl.remove(), 3000);
});

document.getElementById('btn-cancel-save-preset')?.addEventListener('click', () => {
  document.getElementById('preset-modal')?.classList.remove('show');
});

document.getElementById('preset-select')?.addEventListener('change', async e => {
  const name = e.target.value;
  if (!name) { return; }
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
