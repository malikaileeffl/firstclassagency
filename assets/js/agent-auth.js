/* Agent authentication — Supabase-backed.
   - Gate page: tabbed Sign in / Create account.
   - Hub pages: redirect to gate if no session, populate name in header.
   To change project, update SUPABASE_URL and SUPABASE_KEY below. */

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
  // Expose on window for debugging if needed
  window.fcaSupabase = sb;

  const path = window.location.pathname;
  const isGate =
    path.endsWith('/index.html') ||
    path === '/' ||
    /\/$/.test(path);
  const isHubPage = path.includes('/agent/');

  const { data: { session } } = await sb.auth.getSession();

  // ----- HUB PAGES -----
  if (isHubPage) {
    if (!session) {
      window.location.replace('../index.html');
      return;
    }

    const user = session.user;
    const fullName =
      (user?.user_metadata && user.user_metadata.full_name) ||
      (user?.email ? user.email.split('@')[0] : 'Agent');
    const firstName = fullName.split(' ')[0];
    const initial = firstName.charAt(0).toUpperCase();

    // Populate any element marked with these data attributes
    document.querySelectorAll('[data-user-name]').forEach((el) => {
      el.textContent = firstName;
    });
    document.querySelectorAll('[data-user-fullname]').forEach((el) => {
      el.textContent = fullName;
    });
    document.querySelectorAll('[data-user-initial]').forEach((el) => {
      el.textContent = initial;
    });
    document.querySelectorAll('[data-user-greeting]').forEach((el) => {
      el.textContent = `Welcome back, ${firstName}`;
    });

    // Reveal user chip(s) once name is loaded
    document.querySelectorAll('[data-user-chip]').forEach((el) => {
      el.style.display = '';
    });

    // Sign out handler(s)
    document.querySelectorAll('[data-logout]').forEach((b) => {
      b.addEventListener('click', async (e) => {
        e.preventDefault();
        await sb.auth.signOut();
        window.location.href = '../index.html';
      });
    });

    return;
  }

  // ----- GATE PAGE -----
  if (isGate) {
    // already signed in? send to dashboard
    if (session) {
      window.location.replace('agent/dashboard.html');
      return;
    }

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
        // Clear any prior messages
        ['signin-err', 'signup-err', 'signup-ok'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) { el.textContent = ''; el.classList.remove('show'); }
        });
      });
    });

    // ----- Sign in -----
    if (signinForm) {
      signinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = signinForm.elements.email.value.trim();
        const password = signinForm.elements.password.value;
        const err = document.getElementById('signin-err');
        const btn = document.getElementById('signin-btn');

        err.classList.remove('show');
        err.textContent = '';
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

    // ----- Create account -----
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
          email,
          password,
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
          // Email confirmation off: signed in immediately
          window.location.href = 'agent/dashboard.html';
        } else {
          // Email confirmation on: ask user to verify
          ok.textContent =
            "Account created. Check your email for a verification link, then come back to sign in.";
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
