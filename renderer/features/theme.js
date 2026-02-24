/**
 * Theme management — apply theme and handle toggle button clicks.
 */
export function applyTheme(theme) {
  const isDark = theme !== 'light';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  const icons = document.querySelectorAll('#btn-theme-toggle .theme-icon, #btn-toggle-theme .theme-icon');
  icons.forEach(el => { el.textContent = isDark ? '☀️' : '🌙'; });
  return isDark ? 'dark' : 'light';
}

async function toggleTheme() {
  const settings  = await window.mtg.getSettings();
  const newTheme  = settings.theme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  await window.mtg.setTheme(newTheme);
}

document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);
document.getElementById('btn-toggle-theme')?.addEventListener('click', toggleTheme);
