/* Agent gate — client-side only.
   This is a soft lock, not real security. Anyone who reads the source can
   bypass it. Don't put truly sensitive content behind this.
   To change the password, edit AGENT_PASSWORD below. */

const AGENT_PASSWORD = 'fc2026';
const SESSION_KEY = 'fca_agent_unlocked';

(() => {
  const path = window.location.pathname;
  // The gate lives at the site root (index.html or "/" or trailing-slash dir).
  const isGate =
    path.endsWith('/index.html') ||
    path === '/' ||
    /\/$/.test(path);
  const isHubPage = path.includes('/agent/');

  // Hub pages: redirect to gate if not unlocked
  if (isHubPage) {
    if (sessionStorage.getItem(SESSION_KEY) !== 'yes') {
      window.location.replace('../index.html');
      return;
    }
    // Wire up logout buttons
    document.querySelectorAll('[data-logout]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = '../index.html';
      })
    );
  }

  // Gate page: handle the form
  if (isGate) {
    // already unlocked? send straight in
    if (sessionStorage.getItem(SESSION_KEY) === 'yes') {
      window.location.replace('agent/dashboard.html');
      return;
    }

    const form = document.getElementById('gate-form');
    const input = document.getElementById('gate-pwd');
    const err = document.getElementById('gate-err');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (input.value === AGENT_PASSWORD) {
          sessionStorage.setItem(SESSION_KEY, 'yes');
          window.location.href = 'agent/dashboard.html';
        } else {
          err.classList.add('show');
          input.value = '';
          input.focus();
        }
      });
    }
  }
})();
