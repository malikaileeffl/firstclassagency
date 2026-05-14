/* Credits pause master switch.
   Lives in the user-menu dropdown. When ON, every action that would consume
   prepaid credits is blocked client-side. Server-side gates (in edge
   functions) will enforce the same rule once Twilio is wired.

   Exposes window.fcAuth.isCreditsPaused() so any feature page can guard its
   credit-consuming actions:

     if (window.fcAuth?.isCreditsPaused?.()) {
       alert('Credits are paused. Resume in the menu to continue.');
       return;
     }
*/
(() => {
  // Cached state, refreshed on auth-ready
  let paused = false;
  let sb = null;
  let user = null;

  // Expose a synchronous check + a setter so other JS can refresh after toggle
  window.fcAuth = window.fcAuth || {};
  window.fcAuth.isCreditsPaused = () => paused;

  document.addEventListener('fca:auth-ready', async (e) => {
    sb = window.fcaSupabase;
    user = e.detail && e.detail.user;
    if (!sb || !user) return;

    // Load the current pause state
    const { data } = await sb.from('profiles').select('credits_paused').eq('id', user.id).maybeSingle();
    paused = !!(data && data.credits_paused);

    injectToggle();
    updateChipBadge();
  });

  // ------- DROPDOWN TOGGLE INJECTION ----------------------------------------

  function injectToggle() {
    const dropdowns = document.querySelectorAll('.user-menu-dropdown');
    dropdowns.forEach(dropdown => {
      // Skip if already injected
      if (dropdown.querySelector('.credits-pause-row')) return;

      // Build a divider + toggle row, insert above the existing divider/sign-out
      const divider = document.createElement('div');
      divider.className = 'user-menu-divider';

      const row = document.createElement('label');
      row.className = 'user-menu-item credits-pause-row';
      row.setAttribute('role', 'menuitemcheckbox');
      row.innerHTML = `
        <span class="credits-pause-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
        </span>
        <span class="credits-pause-label">
          <span class="credits-pause-title">Master Switch</span>
        </span>
        <span class="credits-pause-switch">
          <input type="checkbox" data-pause-check ${paused ? 'checked' : ''} />
          <span class="credits-pause-switch-track"><span class="credits-pause-switch-thumb"></span></span>
        </span>
      `;

      // Insert before the existing divider (which sits above Sign out)
      const existingDivider = dropdown.querySelector('.user-menu-divider');
      if (existingDivider) {
        dropdown.insertBefore(divider, existingDivider);
        dropdown.insertBefore(row, existingDivider);
      } else {
        dropdown.appendChild(divider);
        dropdown.appendChild(row);
      }

      // Wire the toggle
      row.querySelector('[data-pause-check]').addEventListener('change', async (e) => {
        const newVal = e.target.checked;
        e.target.disabled = true;
        const { error } = await sb.from('profiles')
          .update({ credits_paused: newVal })
          .eq('id', user.id);
        e.target.disabled = false;
        if (error) {
          alert('Could not update pause state: ' + error.message);
          e.target.checked = !newVal;
          return;
        }
        paused = newVal;
        updateChipBadge();
        // Let other code on the page react if it cares
        document.dispatchEvent(new CustomEvent('fca:credits-pause-changed', { detail: { paused } }));
      });
    });
  }

  // ------- CHIP BADGE (red dot when paused) ---------------------------------

  function updateChipBadge() {
    document.querySelectorAll('.user-chip').forEach(chip => {
      chip.classList.toggle('is-credits-paused', paused);
    });
  }

  // ------- HELPER USED BY OTHER PAGES ---------------------------------------

  // Wrap any click handler that consumes credits:
  //   button.addEventListener('click', window.fcAuth.guardCredits(myHandler))
  window.fcAuth.guardCredits = (fn, msg) => async function (...args) {
    if (paused) {
      alert(msg || 'Credits are paused. Resume from the menu in the top-right to continue.');
      return;
    }
    return fn.apply(this, args);
  };
})();
