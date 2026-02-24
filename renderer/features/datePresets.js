/**
 * Date range preset buttons — fill filter-from/to and reload all tabs.
 */
import { loadData } from '../sales.js';
import { loadPurchaseData } from '../purchases.js';
import { loadAnalyticsData } from '../analytics.js';

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const days = +btn.dataset.days;
    const to   = new Date();
    const from = days === 0
      ? new Date(to.getFullYear(), 0, 1)
      : new Date(Date.now() - days * 86_400_000);
    document.getElementById('filter-from').value = from.toISOString().split('T')[0];
    document.getElementById('filter-to').value   = to.toISOString().split('T')[0];
    loadData();
    loadPurchaseData();
    loadAnalyticsData();
  });
});
