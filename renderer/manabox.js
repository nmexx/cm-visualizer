/**
 * Manabox inventory tab — load, render, search and export.
 */
import { state } from './state.js';
import { fmtNum, esc, toast, showLoading } from './utils.js';
import { renderManaboxRows, stManabox } from './tables.js';

export async function loadManaboxInventory() {
  stManabox?.reset();
  const result = await window.mtg.getInventoryList();
  state.manaboxItems = result || [];
  renderManaboxInventory(state.manaboxItems);
}

export function renderManaboxInventory(items) {
  state.sortedManabox = items;
  renderManaboxRows(items);
  const el = document.getElementById('manabox-count');
  if (el) { el.textContent = `${fmtNum(items.length)} cards`; }
}

/* ─── Search ─────────────────────────────────────────────────────────────── */

document.getElementById('manabox-search').addEventListener('input', () => {
  const q = document.getElementById('manabox-search').value.toLowerCase().trim();
  const filtered = (state.sortedManabox || state.manaboxItems).filter(item =>
    !q || item.Name?.toLowerCase().includes(q) || item.Set?.toLowerCase().includes(q)
  );
  renderManaboxRows(filtered);
});

/* ─── Import / export button handlers ───────────────────────────────────── */

document.getElementById('btn-import-inventory-inline').addEventListener('click', async () => {
  const settings = await window.mtg.getSettings();
  if (!settings.inventory_file_path) { toast('No inventory file configured — go to Settings', 'error'); return; }
  showLoading(true);
  const result = await window.mtg.importInventoryFile(settings.inventory_file_path);
  showLoading(false);
  if (result?.error) { toast(result.error, 'error'); return; }
  toast(`Loaded: ${fmtNum(result.count)} items`);
  loadManaboxInventory();
});

document.getElementById('btn-export-manabox-xlsx').addEventListener('click', async () => {
  const r = await window.mtg.exportXlsx('manabox');
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
