-- =============================================================================
-- First Class Agency — Credits pause toggle
-- Run AFTER 21-power-dialer.sql.
-- Adds a per-agent "pause spending" flag. When true, every action that
-- would consume credits (SMS send, outbound call, auto-recharge, power-dialer
-- session) is blocked. The monthly phone-number rental still deducts because
-- that's the cost of keeping the agent's number reserved.
-- Idempotent — safe to re-run.
-- =============================================================================

alter table public.profiles
  add column if not exists credits_paused boolean not null default false;

-- Convenience helper for client-side checks
create or replace function public.is_credits_paused()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select credits_paused from public.profiles where id = auth.uid() limit 1),
    false
  );
$$;

grant execute on function public.is_credits_paused() to authenticated;
