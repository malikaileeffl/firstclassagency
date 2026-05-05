/* Theme handler. Loads saved theme from localStorage and applies it to <html>
   before paint to avoid a flash. Exposes window.fcaTheme for setting. */

(() => {
  const KEY = 'fca_theme';
  const valid = ['light', 'dark'];

  function getStored() {
    try {
      const v = localStorage.getItem(KEY);
      return valid.includes(v) ? v : 'dark';
    } catch (_) {
      return 'dark';
    }
  }

  function apply(theme) {
    if (!valid.includes(theme)) theme = 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (_) {}
    // Notify listeners (e.g., particle canvas) that theme changed
    document.dispatchEvent(new CustomEvent('fca:theme-changed', { detail: { theme } }));
  }

  // Apply immediately (this script must be loaded in <head> for no FOUC)
  apply(getStored());

  // Public API
  window.fcaTheme = {
    get: () => document.documentElement.getAttribute('data-theme') || 'dark',
    set: (theme) => apply(theme),
    toggle: () => apply(window.fcaTheme.get() === 'dark' ? 'light' : 'dark'),
  };
})();
