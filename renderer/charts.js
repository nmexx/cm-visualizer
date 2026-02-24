/**
 * Chart.js global defaults and all chart-creation helpers.
 * Chart.js itself is loaded as a plain <script> so `Chart` is a browser global.
 */
import { state } from './state.js';

/* ─── Global Chart.js defaults ───────────────────────────────────────────── */
Chart.defaults.color        = '#6b7a94';
Chart.defaults.borderColor  = '#1e2a3a';
Chart.defaults.font.family  = "'Rajdhani', sans-serif";
Chart.defaults.font.size    = 12;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.padding  = 14;

export const GOLD_PALETTE = [
  '#c9a227','#e8c547','#9b7b1e','#3d8ef0','#2ecc71',
  '#9b59b6','#e74c3c','#7ecfdd','#e8752a','#6b7a94',
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function destroyChart(id) {
  if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
}

export function lineChart(id, labels, data, label = 'Revenue') {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx) { return; }
  state.charts[id] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{
      label, data,
      borderColor: '#c9a227', backgroundColor: 'rgba(201,162,39,0.08)',
      tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: '#c9a227',
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#1e2a3a' }, ticks: { maxTicksLimit: 8 } },
        y: { grid: { color: '#1e2a3a' }, ticks: { callback: v => '€' + v.toFixed(0) } },
      },
    },
  });
}

export function lineChart2(id, labels, data, label = 'Amount', color = '#3d8ef0') {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx) { return; }
  state.charts[id] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{
      label, data,
      borderColor: color, backgroundColor: color + '15',
      tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: color,
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#1e2a3a' }, ticks: { maxTicksLimit: 8 } },
        y: { grid: { color: '#1e2a3a' }, ticks: { callback: v => '€' + v.toFixed(0) } },
      },
    },
  });
}

export function barChart(id, labels, datasets, options = {}) {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx) { return; }
  state.charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: options.legend || { display: false } },
      scales: {
        x: { grid: { display: false }, ...(options.stacked ? { stacked: true } : {}) },
        y: { grid: { color: '#1e2a3a' }, ticks: { callback: v => '€' + v.toFixed(0) }, ...(options.stacked ? { stacked: true } : {}) },
      },
      indexAxis: options.horizontal ? 'y' : 'x',
      ...options.extra,
    },
  });
}

export function doughnutChart(id, labels, data, colors) {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx) { return; }
  state.charts[id] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors || GOLD_PALETTE, borderWidth: 1, borderColor: '#080b12' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } },
      cutout: '60%',
    },
  });
}

export function hbarChart(id, labels, data, color = '#c9a227') {
  destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx) { return; }
  state.charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: color + '99', borderColor: color, borderWidth: 1 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#1e2a3a' }, ticks: { callback: v => '€' + v.toFixed(0) } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
    },
  });
}
