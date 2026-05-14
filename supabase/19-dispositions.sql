-- =============================================================================
-- First Class Agency — Disposition list update
-- Run AFTER 18-lead-type.sql.
-- Replaces the old call_attempts.disposition CHECK constraint with the new
-- 13-disposition list, and updates get_dialer_today_stats so the "contacts"
-- count reflects the new dispositions.
-- Idempotent — safe to re-run.
-- =============================================================================

-- Drop the original check constraint (named by Postgres convention)
alter table public.call_attempts
  drop constraint if exists call_attempts_disposition_check;

-- Add the new constraint allowing all 13 dispositions.
-- Order matches the popover top→bottom.
alter table public.call_attempts
  add constraint call_attempts_disposition_check
  check (disposition in (
    'sold',
    'scheduled_appt',
    'think_about_it',
    'social_objection',
    'banking_objection',
    'policy_lapse',
    'missed_first_payment',
    'talk_to_spouse',
    'pick_up_hang_up',
    'busy',
    'exclude_all_drips',
    'bad_number',
    'dnc'
  ));

-- Update the today-stats RPC.
-- New definitions:
--   dials    = every call_attempts row
--   contacts = any disposition where the agent actually engaged a person
--              (excludes bad_number, dnc, busy, pick_up_hang_up, exclude_all_drips)
--   sold     = disposition = 'sold'
drop function if exists public.get_dialer_today_stats();

create or replace function public.get_dialer_today_stats()
returns table (
  dials       integer,
  contacts    integer,
  sold        integer
)
language sql
security definer
set search_path = public
as $$
  with bounds as (
    select
      date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York' as start_t,
      (date_trunc('day', now() at time zone 'America/New_York') + interval '1 day') at time zone 'America/New_York' as end_t
  )
  select
    count(*)::int                                                                                                       as dials,
    count(*) filter (where disposition not in ('bad_number','dnc','busy','pick_up_hang_up','exclude_all_drips'))::int    as contacts,
    count(*) filter (where disposition = 'sold')::int                                                                    as sold
  from public.call_attempts ca, bounds b
  where ca.agent_id = auth.uid()
    and ca.called_at >= b.start_t
    and ca.called_at <  b.end_t;
$$;

grant execute on function public.get_dialer_today_stats() to authenticated;
