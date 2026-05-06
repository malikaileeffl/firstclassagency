-- =============================================================================
-- First Class Agency — onboarding tracking setup
-- Run this in Supabase → SQL Editor (one-time setup).
-- Creates: profiles mirror, user_roles, onboarding_progress, plus RLS + triggers.
-- =============================================================================

-- 1) PROFILES mirror of auth.users so admins can list agents by name/email.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  avatar_url  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-populate profiles when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile in sync when user metadata changes
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set
    full_name  = coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    email      = new.email,
    avatar_url = new.raw_user_meta_data->>'avatar_url',
    updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_updated();

-- One-time backfill for any users who already exist
insert into public.profiles (id, full_name, email, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.email,
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (id) do nothing;


-- 2) USER_ROLES — admins / agents
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin', 'agent')),
  created_at timestamptz default now()
);

-- Helper used by RLS policies. SECURITY DEFINER bypasses RLS so we don't recurse.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;


-- 3) ONBOARDING_PROGRESS — one row per user, current_step 0–9
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_progress (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  current_step     int not null default 0 check (current_step >= 0 and current_step <= 9),
  started_at       timestamptz default now(),
  last_advanced_at timestamptz default now()
);


-- 4) ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.user_roles          enable row level security;
alter table public.onboarding_progress enable row level security;

-- profiles: any authenticated user can read; only the owner can update.
drop policy if exists "profiles_select_auth"     on public.profiles;
drop policy if exists "profiles_update_self"     on public.profiles;
create policy "profiles_select_auth"
  on public.profiles for select to authenticated
  using (true);
create policy "profiles_update_self"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

-- user_roles: users see their own row; admins manage all.
drop policy if exists "roles_select_self"   on public.user_roles;
drop policy if exists "roles_select_admin"  on public.user_roles;
drop policy if exists "roles_admin_all"     on public.user_roles;
create policy "roles_select_self"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);
create policy "roles_select_admin"
  on public.user_roles for select to authenticated
  using (public.is_admin());
create policy "roles_admin_all"
  on public.user_roles for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- onboarding_progress: users read+write own; admins read+write all.
drop policy if exists "progress_select_self"   on public.onboarding_progress;
drop policy if exists "progress_select_admin"  on public.onboarding_progress;
drop policy if exists "progress_insert_self"   on public.onboarding_progress;
drop policy if exists "progress_update_self"   on public.onboarding_progress;
drop policy if exists "progress_update_admin"  on public.onboarding_progress;
create policy "progress_select_self"
  on public.onboarding_progress for select to authenticated
  using (auth.uid() = user_id);
create policy "progress_select_admin"
  on public.onboarding_progress for select to authenticated
  using (public.is_admin());
create policy "progress_insert_self"
  on public.onboarding_progress for insert to authenticated
  with check (auth.uid() = user_id);
create policy "progress_update_self"
  on public.onboarding_progress for update to authenticated
  using (auth.uid() = user_id);
create policy "progress_update_admin"
  on public.onboarding_progress for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- =============================================================================
-- 5) MAKE YOURSELF AN ADMIN
-- Run this once after the rest. Replace the email if needed.
-- =============================================================================
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'malikailee.ffl@gmail.com'
on conflict (user_id) do update set role = excluded.role;
