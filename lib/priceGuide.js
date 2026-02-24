/**
 * Price guide: download, cache and enrichment logic.
 *
 * Avoids raw https/http requires by using electron.net.fetch() which:
 *  - Respects system proxy settings
 *  - Uses the OS certificate store (no corporate-proxy issues)
 *  - Supports standard Fetch API with proper timeouts via AbortSignal
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const PRICE_GUIDE_URL = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_1.json';

/**
 * Download the Cardmarket price guide JSON to `destPath`.
 * Uses electron.net.fetch so proxy/certificate settings are honoured.
 * Times out after 60 s.
 *
 * @param {string} destPath
 * @returns {Promise<{count: number, createdAt: string}>}
 */
async function downloadPriceGuide(destPath) {
  const { net } = require('electron');

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 60_000);

  let raw;
  try {
    const response = await net.fetch(PRICE_GUIDE_URL, { signal: controller.signal });
    if (!response.ok) { throw new Error(`HTTP ${response.status}`); }
    raw = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  // Validate before touching disk
  const data = JSON.parse(raw);
  if (!Array.isArray(data.priceGuides)) {
    throw new Error('Unexpected price guide format — priceGuides array missing');
  }

  const tmpPath = destPath + '.tmp';
  fs.writeFileSync(tmpPath, raw, 'utf-8');
  fs.renameSync(tmpPath, destPath);

  return {
    count:     data.priceGuides.length,
    createdAt: data.createdAt || new Date().toISOString(),
  };
}

/**
 * Load a saved price guide JSON file into the provided Map.
 * The map is keyed by idProduct (integer).
 *
 * @param {string}        filePath
 * @param {Map<number, object>} cache   — cleared then populated in place
 */
function loadPriceGuideIntoCache(filePath, cache) {
  if (!fs.existsSync(filePath)) { return; }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    cache.clear();
    for (const entry of (data.priceGuides || [])) {
      cache.set(entry.idProduct, entry);
    }
  } catch {
    /* ignore parse errors — file may be partially written */
  }
}

/**
 * Annotate each inventory row with current market prices from `cache`.
 * Mutates rows in place; adds `market_price`, `market_price_foil`, `market_value`.
 *
 * @param {object[]}            inventory
 * @param {Map<number, object>} cache
 * @returns {object[]} the same array (for chaining)
 */
function enrichInventoryWithMarketPrices(inventory, cache) {
  if (cache.size === 0) { return inventory; }
  for (const item of inventory) {
    if (!item.product_id) { continue; }
    const pg = cache.get(parseInt(item.product_id, 10));
    if (!pg) { continue; }
    item.market_price      = pg.trend         ?? pg.avg         ?? null;
    item.market_price_foil = pg['trend-foil'] ?? pg['avg-foil'] ?? null;
    item.market_value      = item.qty_on_hand * (item.market_price || 0);
  }
  return inventory;
}

module.exports = {
  downloadPriceGuide,
  loadPriceGuideIntoCache,
  enrichInventoryWithMarketPrices,
  PRICE_GUIDE_URL,
};
