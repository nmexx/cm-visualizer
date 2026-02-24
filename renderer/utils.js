/* ─── Formatting helpers ─────────────────────────────────────────────────── */

export function fmt(n) {
  if (n === undefined || n === null) { return '€0.00'; }
  return '€' + (+n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function fmtNum(n) {
  return (+n || 0).toLocaleString();
}

export function esc(s) {
  if (s === undefined || s === null) { return ''; }
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function rarityBadge(r) {
  if (!r) { return ''; }
  const cls = { Mythic: 'mythic', Rare: 'rare', Uncommon: 'uncommon', Common: 'common', Land: 'land' }[r] || 'common';
  return `<span class="badge badge-${cls}">${r}</span>`;
}

export function trendHtml(curr, prev) {
  if (!prev || prev === 0) { return ''; }
  const pct = (curr - prev) / Math.abs(prev) * 100;
  if (Math.abs(pct) < 0.5) { return '<span class="kpi-trend flat">→ unchanged</span>'; }
  const dir   = pct > 0 ? 'up' : 'down';
  const arrow = pct > 0 ? '▲' : '▼';
  return `<span class="kpi-trend ${dir}">${arrow} ${Math.abs(pct).toFixed(1)}% vs prior period</span>`;
}

/* ─── Missing months banner ──────────────────────────────────────────────── */

export function renderMissingMonths(months, containerId) {
  const el = document.getElementById(containerId);
  if (!el) { return; }
  if (!months || !months.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = `
    <span class="warn-icon">⚠️</span>
    <div>
      <strong>Missing monthly data detected.</strong>
      Cardmarket exports are per month — the following months have no data imported yet:
      <span class="warn-months">${months.join(', ')}</span>
      <br><span style="color:var(--text-dim);font-size:12px">
        Download each missing month from Cardmarket → Orders → "Sold Orders" / "Purchased Orders" and import.
      </span>
    </div>`;
}

/* ─── Loading overlay & toast ────────────────────────────────────────────── */

export function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show ' + type;
  setTimeout(() => { el.className = ''; }, 3500);
}

export function showLoading(v) {
  document.getElementById('loading').classList.toggle('show', v);
}

/* ─── Build active date filters from the filter bar ─────────────────────── */

export function buildFilters() {
  const from = document.getElementById('filter-from').value;
  const to   = document.getElementById('filter-to').value;
  const f    = {};
  if (from) { f.dateFrom = from; }
  if (to)   { f.dateTo   = to;   }
  return f;
}
