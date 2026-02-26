/**
 * Scryfall card image tooltip — hover over any element with [data-card-name].
 */
const tooltip        = document.getElementById('scryfall-tooltip');
const tooltipImg     = document.getElementById('scryfall-tooltip-img');
const tooltipSpinner = document.getElementById('scryfall-tooltip-spinner');
if (!tooltip) { throw new Error('scryfall-tooltip element not found'); }

const cache    = new Map();
let hoverTimer = null;

function buildCdnUrl(scryfallId) {
  return `https://cards.scryfall.io/normal/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`;
}

/**
 * Convert a Magic set name to Scryfall 3-letter code.
 * Handles some common variations (e.g., "Limited Edition Alpha" → "LEA").
 * Falls back to fuzzy matching if exact conversion unknown.
 */
const SET_NAME_TO_CODE = {
  // Some examples — Scryfall maintains the authoritative list
  // Common modern sets are usually recognized
};

/**
 * Try to get the Scryfall 3-letter set code from a set name.
 * For now, returns the name as-is (Scryfall's search accepts full names).
 * In future, could build a mapping for faster lookups.
 */
function getSetCode(setName) {
  if (!setName) { return null; }
  // Scryfall's search accepts both set codes and full set names
  // Return the set name as provided
  return setName;
}

async function getImageUrl(cardName, scryfallId, setName) {
  // Build cache key from all identifying info
  const cacheKey = scryfallId || `${cardName}|${setName || ''}`;
  if (cache.has(cacheKey)) { return cache.get(cacheKey); }

  let url = null;

  // 1. If we have a scryfall ID, use direct CDN URL (fastest, no API call needed)
  if (scryfallId && scryfallId.length > 8) {
    url = buildCdnUrl(scryfallId);
    cache.set(cacheKey, url);
    return url;
  }

  // 2. Try exact search with set name if available
  if (cardName && setName) {
    try {
      // Query: name:"Card Name" set:SetName
      // This finds the exact card in that specific set
      const query = `name:"${cardName.replace(/"/g, '\\"')}" set:"${setName.replace(/"/g, '\\"')}"`;
      const resp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=art`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.data?.length > 0) {
          const card = data.data[0];
          url = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || null;
        }
      }
    } catch { url = null; }
  }

  // 3. Fall back to fuzzy search with just card name
  if (!url && cardName) {
    try {
      const resp = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
      if (resp.ok) {
        const data = await resp.json();
        url = data.image_uris?.normal || data.card_faces?.[0]?.image_uris?.normal || null;
      }
    } catch { url = null; }
  }

  cache.set(cacheKey, url);
  return url;
}

function positionTooltip(e) {
  const margin = 14;
  const tw     = tooltip.offsetWidth  || 252;
  const th     = tooltip.offsetHeight || 346;
  let x = e.clientX + margin;
  let y = e.clientY + margin;
  if (x + tw > window.innerWidth)  { x = e.clientX - tw - margin; }
  if (y + th > window.innerHeight) { y = e.clientY - th - margin; }
  tooltip.style.left = x + 'px';
  tooltip.style.top  = y + 'px';
}

function hideTooltip() {
  tooltip.style.display        = 'none';
  tooltipImg.src                = '';
  tooltipImg.style.display     = 'none';
  tooltipSpinner.style.display = '';
}

document.addEventListener('mouseover', async e => {
  const el = e.target.closest('[data-card-name]');
  if (!el) { return; }
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(async () => {
    const cardName   = el.dataset.cardName;
    const scryfallId = el.dataset.scryfallId || '';
    const setName    = el.dataset.setName || '';
    if (!cardName) { return; }
    tooltipImg.style.display     = 'none';
    tooltipSpinner.style.display = '';
    tooltip.style.display        = 'block';
    positionTooltip(e);
    const url = await getImageUrl(cardName, scryfallId, setName);
    if (!url) { hideTooltip(); return; }
    tooltipImg.src     = url;
    tooltipImg.onload  = () => { tooltipSpinner.style.display = 'none'; tooltipImg.style.display = 'block'; };
    tooltipImg.onerror = () => hideTooltip();
  }, 300);
});

document.addEventListener('mousemove', e => {
  if (tooltip.style.display !== 'none') { positionTooltip(e); }
});

document.addEventListener('mouseout', e => {
  if (e.target.closest('[data-card-name]') && !e.relatedTarget?.closest('[data-card-name]')) {
    clearTimeout(hoverTimer);
    setTimeout(hideTooltip, 80);
  }
});
