-- =============================================================================
-- First Class Agency — Fix "Database error saving new user" on signup
-- Run this in Supabase → SQL Editor. Idempotent — safe to re-run.
--
-- Root cause:
--   handle_new_user (auth.users INSERT trigger) is SECURITY DEFINER with
--   search_path locked to `public`. When it inserts into public.profiles,
--   the BEFORE INSERT trigger trg_profile_lead_token fires and calls
--   gen_lead_token() -> gen_random_bytes(). pgcrypto's gen_random_bytes lives
--   in the `extensions` schema in Supabase, so the call cannot be resolved
--   with search_path = public. The trigger errors, the insert aborts, and the
--   whole signup is rolled back. Supabase surfaces this as the generic
--   "Database error saving new user".
--
-- Fix: explicitly qualify gen_random_bytes with the extensions schema, and
-- harden the BEFORE INSERT trigger so token generation failure can never
-- block a profile (or signup) from being created — the token can always be
-- backfilled later by public.rotate_my_lead_token() or admin_rotate_lead_token().
-- =============================================================================

-- 1) Make sure pgcrypto is installed (no-op if already there).
create extension if not exists pgcrypto with schema extensions;

-- 2) Rewrite gen_lead_token to explicitly qualify gen_random_bytes.
--    Also pin search_path so it works no matter who calls it.
create or replace function public.gen_lead_token()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select substring(
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', 'abc'),
    1, 24
  );
$$;

-- 3) Harden the BEFORE INSERT trigger so token generation never aborts the
--    insert. If gen_lead_token() ever fails again, the profile is still
--    created with a NULL token and can be rotated later.
create or replace function public.assign_lead_token_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.agent_lead_token is null then
    begin
      new.agent_lead_token := public.gen_lead_token();
    exception when others then
      -- Never block the insert; the token can be backfilled.
      raise warning 'assign_lead_token_on_insert: %', sqlerrm;
      new.agent_lead_token := null;
    end;
  end if;
  return new;
end;
$$;

-- Re-bind the trigger (idempotent).
drop trigger if exists trg_profile_lead_token on public.profiles;
create trigger trg_profile_lead_token
  before insert on public.profiles
  for each row execute function public.assign_lead_token_on_insert();

-- 4) Also harden handle_new_user the same way, so any future failure inside
--    a profile-side trigger is logged but does not abort signup. Auth users
--    can always survive without a profile row; we backfill below.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  begin
    insert into public.profiles (id, full_name, email, avatar_url)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email,
      new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (id) do nothing;
  exception when others then
    -- Don't let a profile-side failure block account creation. Log and move on.
    raise warning 'handle_new_user: %', sqlerrm;
  end;
  return new;
end;
$$;

-- 5) Backfill any auth.users that signed up while this was broken and never
--    got a profile row. Safe to run repeatedly — on conflict do nothing.
insert into public.profiles (id, full_name, email, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.email,
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 6) Backfill agent_lead_token for any profiles still missing one.
update public.profiles
   set agent_lead_token = public.gen_lead_token()
 where agent_lead_token is null;
