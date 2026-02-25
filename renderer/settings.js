/**
 * Settings tab & app initialisation — reads persisted settings, wires buttons,
 * handles auto-import push events, and bootstraps all tab data on startup.
 */
import { toast, showLoading } from './utils.js';
import { applyTheme } from './features/theme.js';
import { refreshPresetSelect } from './features/filterPresets.js';
import { loadData } from './sales.js';
import { loadPurchaseData } from './purchases.js';
import { loadAnalyticsData } from './analytics.js';
import { loadManaboxInventory } from './manabox.js';

/* ─── Settings button handlers ───────────────────────────────────────────── */

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
  loadAnalyticsData();   // re-enrich inventory with fresh market prices
});

document.getElementById('btn-clear-db').addEventListener('click', async () => {
  if (!confirm('This will delete ALL sales and purchase data. Are you sure?')) { return; }
  await window.mtg.clearDatabase();
  toast('Database cleared');
  loadData();
  loadPurchaseData();
});

/* ─── Auto-import push events (chokidar) ─────────────────────────────────── */

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

/* ─── App init ───────────────────────────────────────────────────────────── */

export async function init() {
  const [settings, dbPath] = await Promise.all([
    window.mtg.getSettings(),
    window.mtg.getDbPath(),
  ]);

  const soldFolder      = settings.csv_folder_sold || settings.csv_folder;
  const purchasedFolder = settings.csv_folder_purchased;
  if (soldFolder)      { document.getElementById('setting-folder-sold').textContent = soldFolder; }
  if (purchasedFolder) { document.getElementById('setting-folder-purchased').textContent = purchasedFolder; }

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

  const versionEl = document.getElementById('app-version');
  if (versionEl) { versionEl.textContent = settings.version || ''; }

  applyTheme(settings.theme || 'dark');
  await refreshPresetSelect();

  await Promise.all([loadData(), loadPurchaseData(), loadAnalyticsData(), loadManaboxInventory()]);
}
