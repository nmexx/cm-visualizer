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

async function getImageUrl(cardName, scryfallId) {
  const key = scryfallId || cardName;
  if (cache.has(key)) { return cache.get(key); }
  let url = null;
  if (scryfallId && scryfallId.length > 8) {
    url = buildCdnUrl(scryfallId);
  } else {
    try {
      const resp = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
      if (resp.ok) {
        const data = await resp.json();
        url = data.image_uris?.normal || data.card_faces?.[0]?.image_uris?.normal || null;
      }
    } catch { url = null; }
  }
  cache.set(key, url);
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
    if (!cardName) { return; }
    tooltipImg.style.display     = 'none';
    tooltipSpinner.style.display = '';
    tooltip.style.display        = 'block';
    positionTooltip(e);
    const url = await getImageUrl(cardName, scryfallId);
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
