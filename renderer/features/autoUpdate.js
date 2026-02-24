/**
 * Auto-update UI — shows banners and handles install/check buttons.
 */
window.mtg.onUpdateAvailable?.(() => {
  const banner = document.getElementById('update-banner');
  if (banner) { banner.style.display = 'flex'; }
  const st = document.getElementById('update-status');
  if (st) { st.textContent = 'New version available — downloading…'; }
});

window.mtg.onUpdateDownloaded?.(() => {
  const st = document.getElementById('update-status');
  if (st) { st.textContent = 'Update ready to install. Restart to apply.'; }
});

document.getElementById('btn-install-update')?.addEventListener('click', () => {
  window.mtg.installUpdate();
});

document.getElementById('btn-dismiss-update')?.addEventListener('click', () => {
  const banner = document.getElementById('update-banner');
  if (banner) { banner.style.display = 'none'; }
});

document.getElementById('btn-check-update')?.addEventListener('click', async () => {
  const st = document.getElementById('update-status');
  if (st) { st.textContent = 'Checking…'; }
  const r = await window.mtg.checkForUpdate();
  if (st) {
    st.textContent =
      r?.status === 'dev'         ? 'Running in development mode' :
      r?.status === 'checking'    ? 'Check initiated…'            :
      r?.status === 'unavailable' ? 'Already up to date'          :
      r?.status || 'Unknown status';
  }
});

// Show version in settings tab
window.mtg.getSettings().then(s => {
  const verEl = document.getElementById('app-version');
  if (verEl && s?.version) { verEl.textContent = s.version; }
}).catch(() => {});
