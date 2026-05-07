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

    // Resolve role + reveal admin-only UI
    const role = await checkRole(sb, user.id);
    const isAdmin = role === 'admin' || role === 'super_admin';
    const isSuperAdmin = role === 'super_admin';

    window.fcAuth = window.fcAuth || {};
    window.fcAuth.user = user;
    window.fcAuth.role = role;
    window.fcAuth.isAdmin = isAdmin;
    window.fcAuth.isSuperAdmin = isSuperAdmin;
    window.fcAuth.sb = sb;
    window.fcAuth.getProgress = () => getMyProgress(sb, user.id);
    window.fcAuth.markWeek = (week) => markWeekComplete(sb, user.id, week);
    window.fcAuth.unmarkWeek = (week) => unmarkWeekComplete(sb, user.id, week);
    window.fcAuth.saveProgress = (taskProgress, completedWeeks) => savePartialProgress(sb, user.id, taskProgress, completedWeeks);
    window.fcAuth.listTeam = () => listTeamProgress(sb);
    window.fcAuth.setWeeks = (uid, weeks, taskProgress) => setWeeksFor(sb, uid, weeks, taskProgress);
    window.fcAuth.listAdminCandidates = () => listAdminCandidates(sb);
    window.fcAuth.setManager = (uid, managerId) => setManagerFor(sb, uid, managerId);
    window.fcAuth.listSchedulingAdmins = () => listSchedulingAdmins(sb);
    window.fcAuth.setCalendlyUrl = (url) => setCalendlyUrl(sb, user.id, url);
    window.fcAuth.setTrainingStatus = (dateStr, status) => setTrainingStatus(sb, user.id, dateStr, status);

    document.querySelectorAll('[data-admin-only]').forEach((el) => {
      el.style.display = isAdmin ? '' : 'none';
    });
    document.dispatchEvent(new CustomEvent('fca:auth-ready', {
      detail: { user, isAdmin, isSuperAdmin, role }
    }));

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
    const avatarUrl = user?.user_metadata?.avatar_url;

    document.querySelectorAll('[data-user-name]').forEach((el) => { el.textContent = firstName; });
    document.querySelectorAll('[data-user-fullname]').forEach((el) => { el.textContent = fullName; });
    document.querySelectorAll('[data-user-initial]').forEach((el) => {
      applyAvatar(el, avatarUrl, initial);
    });
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

  function applyAvatar(el, avatarUrl, initial) {
    el.innerHTML = '';
    el.classList.remove('avatar-with-image');
    if (avatarUrl) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = '';
      img.draggable = false;
      img.onerror = () => {
        // Image failed (deleted, broken URL) — fall back to initial
        el.innerHTML = '';
        el.classList.remove('avatar-with-image');
        el.textContent = initial;
      };
      el.appendChild(img);
      el.classList.add('avatar-with-image');
    } else {
      el.textContent = initial;
    }
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
    // Avatar upload + remove
    wireAvatarControl(sb, user);

    // Pre-fill name input
    const fullName = getFullName(user);
    const nameInput = document.getElementById('profile-name');
    if (nameInput) nameInput.value = fullName;

    // Pre-fill Calendly URL if user is admin (field is hidden for agents).
    const calendlyInput = document.getElementById('profile-calendly');
    if (calendlyInput) {
      sb.from('profiles').select('calendly_url').eq('id', user.id).maybeSingle()
        .then(({ data }) => {
          if (data && data.calendly_url) calendlyInput.value = data.calendly_url;
        })
        .catch((e) => console.warn('[FCA] could not fetch calendly_url:', e.message));
    }

    // Profile save
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = nameInput.value.trim();
        const newCalendly = calendlyInput ? calendlyInput.value.trim() : null;
        const status = document.getElementById('profile-status');
        const btn = document.getElementById('profile-save-btn');
        if (!newName) { showStatus(status, 'Name cannot be empty.', true); return; }
        if (newCalendly && !/^https?:\/\//i.test(newCalendly)) {
          showStatus(status, 'Calendly URL should start with https://', true);
          return;
        }

        btn.disabled = true; btn.textContent = 'Saving…';
        status.classList.remove('show', 'error');
        const { error } = await sb.auth.updateUser({ data: { full_name: newName } });
        // Save Calendly URL to profile (only relevant for admins; harmless for others)
        if (calendlyInput) {
          try {
            await setCalendlyUrl(sb, user.id, newCalendly);
          } catch (calErr) {
            // Non-fatal — name still saved. Surface a soft warning.
            console.warn('[FCA] calendly save failed:', calErr.message);
          }
        }
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

  // ---------- AVATAR UPLOAD ----------

  function wireAvatarControl(sb, initialUser) {
    const uploadBtn = document.getElementById('avatar-upload-btn');
    const removeBtn = document.getElementById('avatar-remove-btn');
    const fileInput = document.getElementById('avatar-input');
    const status = document.getElementById('avatar-status');

    if (!uploadBtn || !fileInput) return;

    let currentUser = initialUser;

    function refreshRemoveBtn() {
      if (!removeBtn) return;
      removeBtn.style.display = currentUser?.user_metadata?.avatar_url ? '' : 'none';
    }
    refreshRemoveBtn();

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showStatus(status, 'Please select an image (JPG, PNG, or WEBP).', true);
        fileInput.value = '';
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        showStatus(status, 'Image too large. Max 8 MB.', true);
        fileInput.value = '';
        return;
      }

      uploadBtn.disabled = true;
      if (removeBtn) removeBtn.disabled = true;
      const original = uploadBtn.textContent;
      uploadBtn.textContent = 'Uploading…';
      status.classList.remove('show', 'error');

      try {
        await uploadAvatar(sb, currentUser, file);
        const { data: { user: refreshed } } = await sb.auth.getUser();
        if (refreshed) {
          currentUser = refreshed;
          populateUser(refreshed);
          refreshRemoveBtn();
        }
        showStatus(status, 'Photo updated.');
      } catch (err) {
        showStatus(status, friendlyAvatarError(err), true);
      } finally {
        uploadBtn.disabled = false;
        if (removeBtn) removeBtn.disabled = false;
        uploadBtn.textContent = original;
        fileInput.value = '';
      }
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        removeBtn.disabled = true;
        uploadBtn.disabled = true;
        const original = removeBtn.textContent;
        removeBtn.textContent = 'Removing…';
        status.classList.remove('show', 'error');

        try {
          await sb.auth.updateUser({ data: { avatar_url: null } });
          const { data: { user: refreshed } } = await sb.auth.getUser();
          if (refreshed) {
            currentUser = refreshed;
            populateUser(refreshed);
            refreshRemoveBtn();
          }
          showStatus(status, 'Photo removed.');
        } catch (err) {
          showStatus(status, friendlyAvatarError(err), true);
        } finally {
          uploadBtn.disabled = false;
          removeBtn.disabled = false;
          removeBtn.textContent = original;
        }
      });
    }
  }

  async function uploadAvatar(sb, user, file) {
    const blob = await resizeToSquare(file, 256);
    const fileName = `${user.id}/${Date.now()}.jpg`;

    const { error: uploadError } = await sb.storage
      .from('avatars')
      .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(fileName);

    const { error: updateError } = await sb.auth.updateUser({
      data: { avatar_url: publicUrl },
    });
    if (updateError) throw updateError;

    return publicUrl;
  }

  function resizeToSquare(file, dim) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not load image.'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = dim;
          canvas.height = dim;
          const ctx = canvas.getContext('2d');
          // Center-crop to square
          const sqSize = Math.min(img.width, img.height);
          const sx = (img.width - sqSize) / 2;
          const sy = (img.height - sqSize) / 2;
          ctx.drawImage(img, sx, sy, sqSize, sqSize, 0, 0, dim, dim);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Could not encode image.'));
            },
            'image/jpeg',
            0.9
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function friendlyAvatarError(err) {
    const msg = (err && (err.message || err.error_description)) || '';
    const m = msg.toLowerCase();
    if (m.includes('bucket not found')) {
      return 'Avatar storage isn\'t set up yet. Create a bucket called "avatars" in Supabase.';
    }
    if (m.includes('row-level security') || m.includes('not allowed') || m.includes('unauthorized')) {
      return 'Storage permissions block this upload. Bucket needs to be set to public.';
    }
    if (m.includes('exceeded')) return 'Storage quota reached. Reach out to your admin.';
    return msg || 'Upload failed. Please try again.';
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

    // ----- FORGOT PASSWORD -----
    const forgotLink = document.getElementById('forgot-link');
    const forgotForm = document.getElementById('forgot-form');
    const forgotBack = document.getElementById('forgot-back');
    const tabsRow = document.querySelector('.auth-tabs');

    function showForgot() {
      signinForm.classList.add('hidden');
      signupForm.classList.add('hidden');
      forgotForm.classList.remove('hidden');
      if (tabsRow) tabsRow.style.display = 'none';
      if (heading) heading.textContent = 'Reset your password.';
      if (sub) sub.textContent = "We'll email you a secure link to set a new one.";
      // Pre-fill from sign-in if they typed there first
      const signedInEmail = signinForm.elements.email.value.trim();
      if (signedInEmail) document.getElementById('forgot-email').value = signedInEmail;
      ['signin-err', 'signup-err', 'signup-ok', 'forgot-err', 'forgot-ok'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.classList.remove('show'); }
      });
    }

    function hideForgot() {
      forgotForm.classList.add('hidden');
      signinForm.classList.remove('hidden');
      if (tabsRow) tabsRow.style.display = '';
      // Reset the active tab to sign-in
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === 'signin'));
      if (heading) heading.textContent = 'Welcome back.';
      if (sub) sub.textContent = 'Sign in with your agent account, or create one if you’re new.';
    }

    if (forgotLink) forgotLink.addEventListener('click', showForgot);
    if (forgotBack) forgotBack.addEventListener('click', hideForgot);

    if (forgotForm) {
      forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = forgotForm.elements.email.value.trim();
        const err = document.getElementById('forgot-err');
        const ok = document.getElementById('forgot-ok');
        const btn = document.getElementById('forgot-btn');
        err.classList.remove('show'); err.textContent = '';
        ok.classList.remove('show'); ok.textContent = '';
        btn.disabled = true;
        const original = btn.innerHTML;
        btn.textContent = 'Sending…';

        const redirectTo = `${window.location.origin}/reset-password.html`;
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

        btn.disabled = false;
        btn.innerHTML = original;

        // Always show success-style messaging (don't leak whether the email exists)
        if (error) {
          console.warn('[FCA] reset email failed:', error.message);
          // Even on error, show generic message to avoid email enumeration
        }
        ok.textContent = `If an account exists for ${email}, a reset link is on its way. Check your inbox (and spam folder).`;
        ok.classList.add('show');
        forgotForm.reset();
      });
    }
  }

  // -------------------------------------------------------------------------
  // role + onboarding progress
  // -------------------------------------------------------------------------

  async function checkRole(sb, userId) {
    const { data, error } = await sb
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[FCA] role lookup failed:', error.message);
      return 'agent';
    }
    return (data && data.role) || 'agent';
  }

  async function getMyProgress(sb, userId) {
    const { data, error } = await sb
      .from('onboarding_progress')
      .select('completed_weeks, task_progress, training_attendance, started_at, last_advanced_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[FCA] progress lookup failed:', error.message);
      return { completed_weeks: [], task_progress: {}, training_attendance: {} };
    }
    if (!data) {
      const now = new Date().toISOString();
      const { error: insertErr } = await sb
        .from('onboarding_progress')
        .insert({ user_id: userId, completed_weeks: [], task_progress: {}, training_attendance: {}, started_at: now, last_advanced_at: now });
      if (insertErr) console.warn('[FCA] progress seed failed:', insertErr.message);
      return { completed_weeks: [], task_progress: {}, training_attendance: {}, started_at: now, last_advanced_at: now };
    }
    return {
      ...data,
      completed_weeks: data.completed_weeks || [],
      task_progress: data.task_progress || {},
      training_attendance: data.training_attendance || {},
    };
  }

  async function setTrainingStatus(sb, userId, dateStr, status) {
    // status is 'attended' or 'missed'. Idempotent — once a value is written
    // for that date, repeat clicks don't overwrite (their first decision sticks).
    const allowed = status === 'attended' || status === 'missed';
    if (!allowed) throw new Error('status must be "attended" or "missed"');
    const { data, error: getErr } = await sb
      .from('onboarding_progress')
      .select('training_attendance')
      .eq('user_id', userId)
      .maybeSingle();
    if (getErr) {
      console.warn('[FCA] attendance read failed:', getErr.message);
      throw getErr;
    }
    const attendance = (data && data.training_attendance) || {};
    if (attendance[dateStr]) return attendance; // already recorded, no-op
    attendance[dateStr] = status;
    const now = new Date().toISOString();
    const { error } = await sb
      .from('onboarding_progress')
      .upsert(
        { user_id: userId, training_attendance: attendance, last_advanced_at: now },
        { onConflict: 'user_id' }
      );
    if (error) {
      console.warn('[FCA] attendance write failed:', error.message);
      throw error;
    }
    return attendance;
  }

  async function savePartialProgress(sb, userId, taskProgress, completedWeeks) {
    const sortedWeeks = [...new Set(completedWeeks || [])]
      .map((w) => parseInt(w, 10))
      .filter((w) => w >= 1 && w <= 8)
      .sort((a, b) => a - b);
    const now = new Date().toISOString();
    const { error } = await sb
      .from('onboarding_progress')
      .upsert(
        {
          user_id: userId,
          task_progress: taskProgress || {},
          completed_weeks: sortedWeeks,
          last_advanced_at: now,
        },
        { onConflict: 'user_id' }
      );
    if (error) {
      console.warn('[FCA] save progress failed:', error.message);
      throw error;
    }
    return { task_progress: taskProgress || {}, completed_weeks: sortedWeeks, last_advanced_at: now };
  }

  async function markWeekComplete(sb, userId, week) {
    const w = parseInt(week, 10);
    if (!(w >= 1 && w <= 8)) throw new Error('Week must be 1..8');
    const current = await getMyProgress(sb, userId);
    const set = new Set(current.completed_weeks || []);
    set.add(w);
    const newWeeks = Array.from(set).sort((a, b) => a - b);
    const now = new Date().toISOString();
    const { error } = await sb
      .from('onboarding_progress')
      .upsert(
        { user_id: userId, completed_weeks: newWeeks, last_advanced_at: now },
        { onConflict: 'user_id' }
      );
    if (error) {
      console.warn('[FCA] mark week failed:', error.message);
      throw error;
    }
    return { completed_weeks: newWeeks, last_advanced_at: now };
  }

  async function unmarkWeekComplete(sb, userId, week) {
    const w = parseInt(week, 10);
    if (!(w >= 1 && w <= 8)) throw new Error('Week must be 1..8');
    const current = await getMyProgress(sb, userId);
    const set = new Set(current.completed_weeks || []);
    set.delete(w);
    const newWeeks = Array.from(set).sort((a, b) => a - b);
    const now = new Date().toISOString();
    const { error } = await sb
      .from('onboarding_progress')
      .upsert(
        { user_id: userId, completed_weeks: newWeeks, last_advanced_at: now },
        { onConflict: 'user_id' }
      );
    if (error) throw error;
    return { completed_weeks: newWeeks, last_advanced_at: now };
  }

  async function listTeamProgress(sb) {
    const [{ data: profiles, error: pErr }, { data: progress, error: gErr }] = await Promise.all([
      sb.from('profiles').select('id, full_name, email, avatar_url, created_at, manager_id').order('created_at', { ascending: true }),
      sb.from('onboarding_progress').select('user_id, completed_weeks, task_progress, training_attendance, started_at, last_advanced_at'),
    ]);
    if (pErr) throw pErr;
    if (gErr) throw gErr;
    const progressByUser = new Map((progress || []).map((p) => [p.user_id, {
      ...p,
      completed_weeks: p.completed_weeks || [],
      task_progress: p.task_progress || {},
      training_attendance: p.training_attendance || {},
    }]));
    const profileById = new Map((profiles || []).map((p) => [p.id, p]));
    return (profiles || []).map((p) => ({
      ...p,
      manager: p.manager_id ? (profileById.get(p.manager_id) || null) : null,
      progress: progressByUser.get(p.id) || { completed_weeks: [], task_progress: {}, training_attendance: {}, started_at: null, last_advanced_at: null },
    }));
  }

  async function listAdminCandidates(sb) {
    // Returns profiles for users with role admin or super_admin.
    // Used by super admin to populate the "manager" dropdown.
    const { data: roles, error: rErr } = await sb
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['admin', 'super_admin']);
    if (rErr) throw rErr;
    const ids = (roles || []).map((r) => r.user_id);
    if (!ids.length) return [];
    const { data: profiles, error: pErr } = await sb
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ids);
    if (pErr) throw pErr;
    return profiles || [];
  }

  async function listSchedulingAdmins(sb) {
    // Returns admins (and super_admins) who have a non-empty Calendly URL.
    // Used by the celebration modal so agents can pick a manager to schedule with.
    const { data: roles, error: rErr } = await sb
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['admin', 'super_admin']);
    if (rErr) {
      console.warn('[FCA] role fetch failed:', rErr.message);
      return [];
    }
    const ids = (roles || []).map((r) => r.user_id);
    if (!ids.length) return [];
    const { data: profiles, error: pErr } = await sb
      .from('profiles')
      .select('id, full_name, email, avatar_url, calendly_url')
      .in('id', ids);
    if (pErr) {
      console.warn('[FCA] admin profile fetch failed:', pErr.message);
      return [];
    }
    const roleByUser = new Map((roles || []).map((r) => [r.user_id, r.role]));
    return (profiles || [])
      .filter((p) => p.calendly_url && p.calendly_url.trim())
      .map((p) => ({ ...p, role: roleByUser.get(p.id) || 'admin' }))
      .sort((a, b) => {
        // Super admins first, then alphabetical
        if (a.role !== b.role) return a.role === 'super_admin' ? -1 : 1;
        return (a.full_name || '').localeCompare(b.full_name || '');
      });
  }

  async function setCalendlyUrl(sb, userId, url) {
    const cleaned = (url || '').trim();
    const { error } = await sb
      .from('profiles')
      .update({ calendly_url: cleaned || null })
      .eq('id', userId);
    if (error) throw error;
    return cleaned || null;
  }

  async function setManagerFor(sb, userId, managerId) {
    const { error } = await sb
      .from('profiles')
      .update({ manager_id: managerId || null })
      .eq('id', userId);
    if (error) throw error;
    return managerId || null;
  }

  async function setWeeksFor(sb, userId, weeks, taskProgress) {
    const sorted = [...new Set(weeks || [])]
      .map((w) => parseInt(w, 10))
      .filter((w) => w >= 1 && w <= 8)
      .sort((a, b) => a - b);
    const now = new Date().toISOString();
    const payload = {
      user_id: userId,
      completed_weeks: sorted,
      last_advanced_at: now,
    };
    if (taskProgress && typeof taskProgress === 'object') {
      payload.task_progress = taskProgress;
    }
    const { error } = await sb
      .from('onboarding_progress')
      .upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;
    return sorted;
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
