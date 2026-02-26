/**
 * Manabox inventory tab — load, render, search and export.
 */
import { state } from './state.js';
import { fmtNum, esc, toast, showLoading } from './utils.js';
import { renderManaboxRows, stManabox } from './tables.js';

const SCRYFALL_CARD_API = 'https://api.scryfall.com/cards/';
const scryfallPriceCache = new Map();
const scryfallPriceInflight = new Map();

async function fetchScryfallPrices(scryfallId) {
  if (!scryfallId) { return null; }
  if (scryfallPriceCache.has(scryfallId)) { return scryfallPriceCache.get(scryfallId); }
  if (scryfallPriceInflight.has(scryfallId)) { return scryfallPriceInflight.get(scryfallId); }

  const req = (async () => {
    try {
      const resp = await fetch(`${SCRYFALL_CARD_API}${scryfallId}`);
      if (!resp.ok) { return null; }
      const data = await resp.json();
      const prices = {
        usd: data?.prices?.usd ?? null,
        usd_foil: data?.prices?.usd_foil ?? null,
      };
      scryfallPriceCache.set(scryfallId, prices);
      return prices;
    } catch {
      return null;
    } finally {
      scryfallPriceInflight.delete(scryfallId);
    }
  })();

  scryfallPriceInflight.set(scryfallId, req);
  return req;
}

function applyMarketPricing(items) {
  for (const item of items) {
    if (!item.scryfall_id) { continue; }
    const prices = scryfallPriceCache.get(item.scryfall_id);
    if (!prices) { continue; }
    const rawPrice = item.is_foil ? (prices.usd_foil ?? prices.usd) : prices.usd;
    const marketPrice = rawPrice != null ? parseFloat(rawPrice) : null;
    item.market_price = Number.isFinite(marketPrice) ? marketPrice : null;
    if (item.market_price != null && item.purchase_price) {
      item.market_diff_pct = ((item.market_price - item.purchase_price) / item.purchase_price) * 100;
    } else {
      item.market_diff_pct = null;
    }
  }
}

async function enrichManaboxMarketPrices(items) {
  const ids = Array.from(new Set(items.map(i => i.scryfall_id).filter(Boolean)));
  const pending = ids.filter(id => !scryfallPriceCache.has(id));
  if (!pending.length) {
    applyMarketPricing(items);
    return;
  }

  const queue = [...pending];
  const workers = Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      await fetchScryfallPrices(id);
      await new Promise(resolve => setTimeout(resolve, 120));
    }
  });
  await Promise.all(workers);
  applyMarketPricing(items);
}

export async function loadManaboxInventory() {
  stManabox?.reset();
  const result = await window.mtg.getInventoryList();
  // GET_INVENTORY_LIST returns { items, page, pageCount, totalCount } for pagination
  const items = result?.items || result || [];
  state.manaboxItems = items;
  state.manaboxPagination = result?.pageCount ? result : null; // Store pagination info if available
  renderManaboxInventory(items);

  // Enrich with market prices in the background (Scryfall USD prices)
  enrichManaboxMarketPrices(items).then(() => {
    renderManaboxInventory(items);
  });
}

export function renderManaboxInventory(items) {
  state.sortedManabox = items;
  renderManaboxRows(items);
  const el = document.getElementById('manabox-count');
  if (el) { el.textContent = `${fmtNum(items.length)} cards`; }
}

/* ─── Search ─────────────────────────────────────────────────────────────── */

document.getElementById('manabox-search').addEventListener('input', () => {
  state.manaboxPage = 1;
  const q = document.getElementById('manabox-search').value.toLowerCase().trim();
  const base = state.manaboxDisplayBase || state.sortedManabox || state.manaboxItems || [];
  const filtered = q ? base.filter(item =>
    !q || item.card_name?.toLowerCase().includes(q) || (item.set_name || item.set_code || '')?.toLowerCase().includes(q)
  ) : base;
  renderManaboxRows(filtered);
});

document.getElementById('manabox-prev')?.addEventListener('click', () => {
  state.manaboxPage--;
  const base = state.manaboxDisplayBase || state.sortedManabox || state.manaboxItems || [];
  renderManaboxRows(base);
});

document.getElementById('manabox-next')?.addEventListener('click', () => {
  state.manaboxPage++;
  const base = state.manaboxDisplayBase || state.sortedManabox || state.manaboxItems || [];
  renderManaboxRows(base);
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
  const r = await window.mtg.exportXlsx({ type: 'manabox', rows: state.manaboxItems || [] });
  if (r?.ok)  { toast('Exported: ' + r.path.split('\\').pop()); }
  else if (r) { toast(r.message || 'Export failed', 'error'); }
});
