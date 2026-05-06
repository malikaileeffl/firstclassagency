-- =============================================================================
-- First Class Agency — admin hierarchy (two-level scoping)
-- Run this in Supabase SQL Editor AFTER onboarding-setup.sql.
-- Adds: manager_id on profiles, super_admin role, scope-based RLS.
-- Idempotent — safe to re-run.
-- =============================================================================

-- 1) Add manager_id column to profiles ----------------------------------------
alter table public.profiles
  add column if not exists manager_id uuid references auth.users(id) on delete set null;

create index if not exists idx_profiles_manager_id on public.profiles(manager_id);


-- 2) Allow 'super_admin' as a role --------------------------------------------
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('admin', 'super_admin', 'agent'));


-- 3) Helper functions ---------------------------------------------------------
-- Super admin: top of the org, sees everyone.
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

-- Team admin (regular admin): sees only their direct reports.
create or replace function public.is_team_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- True when target_user reports directly to me (one level only for now).
-- When you go full MLM later, swap this body for a recursive CTE — no other
-- code needs to change.
create or replace function public.is_my_direct_report(target_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = target_user and manager_id = auth.uid()
  );
$$;

-- Existing is_admin() now means "admin or super_admin" so old policies still
-- match what we want.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;


-- 4) Update profiles SELECT policies so admins only see their team ------------
drop policy if exists "profiles_select_auth"  on public.profiles;
drop policy if exists "profiles_select_self"  on public.profiles;
drop policy if exists "profiles_select_super" on public.profiles;
drop policy if exists "profiles_select_team"  on public.profiles;

-- Self
create policy "profiles_select_self"
  on public.profiles for select to authenticated
  using (auth.uid() = id);
-- Super admin sees all
create policy "profiles_select_super"
  on public.profiles for select to authenticated
  using (public.is_super_admin());
-- Team admin sees direct reports
create policy "profiles_select_team"
  on public.profiles for select to authenticated
  using (public.is_team_admin() and manager_id = auth.uid());

-- Profiles UPDATE: self (existing) + super admin (new). Regular admins cannot
-- reassign managers — that's a super-admin-only operation.
drop policy if exists "profiles_update_super" on public.profiles;
create policy "profiles_update_super"
  on public.profiles for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());


-- 5) Update onboarding_progress policies for scoping --------------------------
drop policy if exists "progress_select_admin"  on public.onboarding_progress;
drop policy if exists "progress_update_admin"  on public.onboarding_progress;
drop policy if exists "progress_select_super"  on public.onboarding_progress;
drop policy if exists "progress_update_super"  on public.onboarding_progress;
drop policy if exists "progress_select_team"   on public.onboarding_progress;
drop policy if exists "progress_update_team"   on public.onboarding_progress;

-- Super admin reads + writes any
create policy "progress_select_super"
  on public.onboarding_progress for select to authenticated
  using (public.is_super_admin());
create policy "progress_update_super"
  on public.onboarding_progress for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Team admin reads + writes only their direct reports
create policy "progress_select_team"
  on public.onboarding_progress for select to authenticated
  using (public.is_team_admin() and public.is_my_direct_report(user_id));
create policy "progress_update_team"
  on public.onboarding_progress for update to authenticated
  using (public.is_team_admin() and public.is_my_direct_report(user_id))
  with check (public.is_team_admin() and public.is_my_direct_report(user_id));


-- 6) Promote Malikai to super_admin -------------------------------------------
update public.user_roles
set role = 'super_admin'
where user_id = (select id from auth.users where email = 'malikailee.ffl@gmail.com');


-- =============================================================================
-- Quick reference (run as super admin, in SQL Editor):
--
-- Make someone a regular admin (they'll see their direct reports only):
--   insert into public.user_roles (user_id, role)
--   select id, 'admin' from auth.users where email = 'team.lead@example.com'
--   on conflict (user_id) do update set role = excluded.role;
--
-- Assign an agent to a manager (must be done by super admin):
--   update public.profiles
--   set manager_id = (select id from auth.users where email = 'team.lead@example.com')
--   where id = (select id from auth.users where email = 'agent@example.com');
--
-- Demote a super admin back to admin (or admin to agent):
--   update public.user_roles set role = 'admin'  where user_id = '...';
--   update public.user_roles set role = 'agent'  where user_id = '...';
-- =============================================================================
