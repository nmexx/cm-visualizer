/**
 * renderer.js — ES module entry point for cm-visualizer.
 *
 * Imports all feature and tab modules (side-effects register event listeners),
 * then wires up tab navigation and bootstraps the app via settings.init().
 */

// ── Core renderer modules ─────────────────────────────────────────────────
import './renderer/state.js';

// ── Tab modules (side-effects: register IPC calls + event listeners) ──────
import './renderer/sales.js';
import './renderer/purchases.js';
import './renderer/analytics.js';
import './renderer/manabox.js';

// ── Feature modules (global UI behaviours) ────────────────────────────────
import './renderer/features/theme.js';
import './renderer/features/dragdrop.js';
import './renderer/features/datePresets.js';
import './renderer/features/filterPresets.js';
import './renderer/features/autoUpdate.js';
import './renderer/features/scryfall.js';

// ── Settings module (imports + exports init()) ────────────────────────────
import { init } from './renderer/settings.js';

/* ─── Tab navigation ─────────────────────────────────────────────────────── */
// Handle collapsible nav groups
document.querySelectorAll('.nav-parent[data-toggle]').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.toggle;
    const target = document.getElementById(targetId);
    const isExpanded = target.classList.contains('expanded');
    
    // Toggle expanded state
    btn.classList.toggle('expanded', !isExpanded);
    target.classList.toggle('expanded', !isExpanded);
  });
});

// Handle page navigation
document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
  });
});

/* ─── Bootstrap ──────────────────────────────────────────────────────────── */
init().catch(err => console.error('[renderer] init failed:', err));
