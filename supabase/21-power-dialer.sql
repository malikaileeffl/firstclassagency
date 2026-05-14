-- =============================================================================
-- First Class Agency — Power Dialer subscription state
-- Run AFTER 20-drip-defaults.sql.
-- Adds per-agent subscription tracking. The actual Power Dialer engine
-- (Twilio Voice / auto-dial / voicemail drop) is a later phase — this
-- migration just stands up the columns the paywall page needs.
-- Idempotent — safe to re-run.
-- =============================================================================

alter table public.profiles
  add column if not exists power_dialer_subscribed         boolean     not null default false,
  add column if not exists power_dialer_subscription_id    text,                             -- Stripe sub_xxx
  add column if not exists power_dialer_started_at         timestamptz,                      -- first subscribed
  add column if not exists power_dialer_renews_at          timestamptz,                      -- next billing date
  add column if not exists power_dialer_cancel_at_period_end boolean   not null default false;

-- Convenience helper for client + RLS predicates.
create or replace function public.has_power_dialer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select power_dialer_subscribed
     from public.profiles
     where id = auth.uid()
     limit 1),
    false
  );
$$;

grant execute on function public.has_power_dialer() to authenticated;
