-- =============================================================================
-- First Class Agency — admin Calendly URLs
-- Run AFTER 04-task-progress.sql.
-- Adds a calendly_url column to profiles plus a select policy that lets
-- agents see admin profiles (so the celebration modal can show a picker).
-- Idempotent — safe to re-run.
-- =============================================================================

-- 1) Per-profile Calendly link (admins only fill this in) --------------------
alter table public.profiles
  add column if not exists calendly_url text;

-- 2) Let any authenticated user read admin/super_admin profiles --------------
-- Existing policies already allow: self, super_admin sees all, team admin
-- sees direct reports. To show the admin picker to every agent, we add one
-- more select policy: any authenticated user can read profiles whose owner
-- has an 'admin' or 'super_admin' role.
drop policy if exists "profiles_select_admin_visibility" on public.profiles;
create policy "profiles_select_admin_visibility"
  on public.profiles for select to authenticated
  using (
    id in (
      select user_id from public.user_roles where role in ('admin', 'super_admin')
    )
  );
