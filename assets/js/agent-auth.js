/* Agent authentication — Supabase-backed.
   Gate page: tabbed Sign in / Create account.
   Hub pages: redirect to gate if no session, populate user info, handle dropdown.
   Account page: profile + security + appearance forms. */

const SUPABASE_URL = 'https://bfctxiwllbiekfxkupjb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VhnuqTPUZwTIMVeNxhP17Q_TxS54DsR';

(async () => {
  if (!window.supabase) {
    console.error('[FCA] Supabase SDK failed to load.');
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
  window.fcaSupabase = sb;

  const path = window.location.pathname;
  const isGate =
    path.endsWith('/index.html') ||
    path === '/' ||
    /\/$/.test(path);
  const isHubPage = path.includes('/agent/');
  const isAccountPage = path.endsWith('/account.html');

  const { data: { session } } = await sb.auth.getSession();

  // ---------- HUB PAGES ----------
  if (isHubPage) {
    if (!session) {
      window.location.replace('../index.html');
      return;
    }

    const user = session.user;
    populateUser(user);
    wireUserMenu(sb);
    wireLogout(sb);

    if (isAccountPage) {
      wireAccountPage(sb, user);
    }

    return;
  }

  // ---------- GATE PAGE ----------
  if (isGate) {
    if (session) {
      window.location.replace('agent/dashboard.html');
      return;
    }
    wireGate(sb);
  }

  // -------------------------------------------------------------------------
  // helpers
  // -------------------------------------------------------------------------

  function getFullName(user) {
    return (user?.user_metadata && user.user_metadata.full_name) ||
           (user?.email ? user.email.split('@')[0] : 'Agent');
  }

  function populateUser(user) {
    const fullName = getFullName(user);
    const firstName = fullName.split(' ')[0];
    const initial = firstName.charAt(0).toUpperCase();

    document.querySelectorAll('[data-user-name]').forEach((el) => { el.textContent = firstName; });
    document.querySelectorAll('[data-user-fullname]').forEach((el) => { el.textContent = fullName; });
    document.querySelectorAll('[data-user-initial]').forEach((el) => { el.textContent = initial; });
    document.querySelectorAll('[data-user-greeting]').forEach((el) => {
      el.textContent = `Welcome back, ${firstName}`;
    });
    document.querySelectorAll('[data-user-email]').forEach((el) => { el.textContent = user?.email || ''; });
    document.querySelectorAll('[data-user-email-input]').forEach((el) => { el.value = user?.email || ''; });
    document.querySelectorAll('[data-user-since]').forEach((el) => {
      const d = user?.created_at ? new Date(user.created_at) : null;
      if (d) {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        el.textContent = `Member since ${months[d.getMonth()]} ${d.getFullYear()}`;
      }
    });

    document.querySelectorAll('[data-user-chip]').forEach((el) => { el.style.display = ''; });
  }

  function wireUserMenu() {
    const menu = document.querySelector('.user-menu');
    if (!menu) return;
    const trigger = menu.querySelector('[data-user-chip-trigger]');
    if (!trigger) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) menu.classList.remove('open');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') menu.classList.remove('open');
    });
  }

  function wireLogout(sb) {
    document.querySelectorAll('[data-logout]').forEach((b) => {
      b.addEventListener('click', async (e) => {
        e.preventDefault();
        await sb.auth.signOut();
        window.location.href = '../index.html';
      });
    });
  }

  function wireAccountPage(sb, user) {
    // Pre-fill name input
    const fullName = getFullName(user);
    const nameInput = document.getElementById('profile-name');
    if (nameInput) nameInput.value = fullName;

    // Profile save
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = nameInput.value.trim();
        const status = document.getElementById('profile-status');
        const btn = document.getElementById('profile-save-btn');
        if (!newName) { showStatus(status, 'Name cannot be empty.', true); return; }

        btn.disabled = true; btn.textContent = 'Saving…';
        status.classList.remove('show', 'error');
        const { error } = await sb.auth.updateUser({ data: { full_name: newName } });
        btn.disabled = false; btn.textContent = 'Save changes';
        if (error) {
          showStatus(status, error.message, true);
        } else {
          showStatus(status, 'Saved.');
          // Update header chip + profile card live
          const { data: { user: refreshed } } = await sb.auth.getUser();
          if (refreshed) populateUser(refreshed);
        }
      });
    }

    // Password change
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
      passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pw = document.getElementById('password-new').value;
        const confirm = document.getElementById('password-confirm').value;
        const status = document.getElementById('password-status');
        const btn = document.getElementById('password-save-btn');

        if (pw.length < 6) { showStatus(status, 'Minimum 6 characters.', true); return; }
        if (pw !== confirm) { showStatus(status, "Passwords don't match.", true); return; }

        btn.disabled = true; btn.textContent = 'Updating…';
        status.classList.remove('show', 'error');
        const { error } = await sb.auth.updateUser({ password: pw });
        btn.disabled = false; btn.textContent = 'Update password';
        if (error) {
          showStatus(status, error.message, true);
        } else {
          showStatus(status, 'Password updated.');
          passwordForm.reset();
        }
      });
    }

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    const themeLabel = document.querySelector('[data-theme-label]');
    function refreshThemeLabel() {
      if (!themeLabel) return;
      themeLabel.textContent = window.fcaTheme.get() === 'dark' ? 'Dark mode' : 'Light mode';
    }
    refreshThemeLabel();
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        window.fcaTheme.toggle();
        refreshThemeLabel();
      });
    }
    document.addEventListener('fca:theme-changed', refreshThemeLabel);
  }

  function showStatus(el, msg, isError) {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('error');
    if (isError) el.classList.add('error');
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3000);
  }

  function wireGate(sb) {
    const tabs = document.querySelectorAll('.auth-tab');
    const signinForm = document.getElementById('signin-form');
    const signupForm = document.getElementById('signup-form');
    const heading = document.getElementById('gate-heading');
    const sub = document.getElementById('gate-sub');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        if (target === 'signin') {
          signinForm.classList.remove('hidden');
          signupForm.classList.add('hidden');
          if (heading) heading.textContent = 'Welcome back.';
          if (sub) sub.textContent = 'Sign in with your agent account, or create one if you’re new.';
        } else {
          signupForm.classList.remove('hidden');
          signinForm.classList.add('hidden');
          if (heading) heading.textContent = 'Create your account.';
          if (sub) sub.textContent = 'Takes 30 seconds. We’ll remember you next time.';
        }
        ['signin-err', 'signup-err', 'signup-ok'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) { el.textContent = ''; el.classList.remove('show'); }
        });
      });
    });

    if (signinForm) {
      signinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = signinForm.elements.email.value.trim();
        const password = signinForm.elements.password.value;
        const err = document.getElementById('signin-err');
        const btn = document.getElementById('signin-btn');
        err.classList.remove('show'); err.textContent = '';
        btn.disabled = true;
        const original = btn.innerHTML;
        btn.textContent = 'Signing in…';
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          err.textContent = friendlyError(error.message);
          err.classList.add('show');
          btn.disabled = false;
          btn.innerHTML = original;
        } else if (data.session) {
          window.location.href = 'agent/dashboard.html';
        }
      });
    }

    if (signupForm) {
      signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = signupForm.elements.fullName.value.trim();
        const email = signupForm.elements.email.value.trim();
        const password = signupForm.elements.password.value;
        const err = document.getElementById('signup-err');
        const ok = document.getElementById('signup-ok');
        const btn = document.getElementById('signup-btn');
        err.classList.remove('show'); err.textContent = '';
        ok.classList.remove('show'); ok.textContent = '';
        btn.disabled = true;
        const original = btn.innerHTML;
        btn.textContent = 'Creating account…';
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: { full_name: fullName } },
        });
        if (error) {
          err.textContent = friendlyError(error.message);
          err.classList.add('show');
          btn.disabled = false;
          btn.innerHTML = original;
          return;
        }
        if (data.session) {
          window.location.href = 'agent/dashboard.html';
        } else {
          ok.textContent = "Account created. Check your email for a verification link, then come back to sign in.";
          ok.classList.add('show');
          signupForm.reset();
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });
    }
  }

  function friendlyError(msg) {
    if (!msg) return 'Something went wrong. Try again.';
    const m = msg.toLowerCase();
    if (m.includes('invalid login credentials')) return 'That email and password don’t match. Try again or create an account.';
    if (m.includes('email not confirmed')) return 'Please verify your email before signing in. Check your inbox for the link.';
    if (m.includes('user already registered')) return 'An account with that email already exists. Switch to "Sign in" instead.';
    if (m.includes('password') && m.includes('characters')) return 'Password must be at least 6 characters.';
    return msg;
  }
})();
