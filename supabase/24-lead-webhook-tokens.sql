-- =============================================================================
-- First Class Agency — Lead webhook ingest tokens
-- Run AFTER 23-auto-pause-on-empty.sql.
--
-- Adds a unique per-agent token that authenticates incoming webhook POSTs from
-- Google Apps Script, Facebook Lead Ads, or any external lead vendor. The
-- token sits in the URL path of the webhook endpoint, so it must be opaque
-- and rotatable. The /leads-webhook-ingest edge function validates it.
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- 1) Column ------------------------------------------------------------------
alter table public.profiles
  add column if not exists agent_lead_token text unique;

create index if not exists idx_profiles_lead_token
  on public.profiles (agent_lead_token)
  where agent_lead_token is not null;

-- 2) Token generator ---------------------------------------------------------
-- 24-char URL-safe random token. Long enough that brute-forcing is infeasible
-- (62^24 ≈ 10^43) and short enough to paste comfortably.
create or replace function public.gen_lead_token()
returns text
language sql
volatile
as $$
  select substring(
    translate(encode(gen_random_bytes(24), 'base64'), '+/=', 'abc'),
    1, 24
  );
$$;

-- 3) Backfill existing profiles with a token if they don't have one ----------
update public.profiles
   set agent_lead_token = public.gen_lead_token()
 where agent_lead_token is null;

-- 4) Auto-generate on profile insert -----------------------------------------
create or replace function public.assign_lead_token_on_insert()
returns trigger language plpgsql as $$
begin
  if new.agent_lead_token is null then
    new.agent_lead_token := public.gen_lead_token();
  end if;
  return new;
end;
$$;
drop trigger if exists trg_profile_lead_token on public.profiles;
create trigger trg_profile_lead_token
  before insert on public.profiles
  for each row execute function public.assign_lead_token_on_insert();

-- 5) Rotate-token RPC (caller must be the owner) ------------------------------
-- Used by the Auto-sync UI when an agent thinks their token has leaked.
create or replace function public.rotate_my_lead_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new text := public.gen_lead_token();
begin
  update public.profiles
     set agent_lead_token = v_new
   where id = auth.uid();
  return v_new;
end;
$$;

grant execute on function public.rotate_my_lead_token() to authenticated;

-- 6) RLS — agents can read their own token only -------------------------------
-- (profiles already has a "read own" policy elsewhere; this column comes along.)
-- No new policy needed.
