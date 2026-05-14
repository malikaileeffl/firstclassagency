-- =============================================================================
-- First Class Agency — Disposition list update
-- Run AFTER 18-lead-type.sql.
-- Replaces the old call_attempts.disposition CHECK constraint with the new
-- 13-disposition list, migrates existing rows from the old values to the
-- closest new equivalent, and updates get_dialer_today_stats so the
-- "contacts" count reflects the new dispositions.
-- Idempotent — safe to re-run.
-- =============================================================================

-- 1) Migrate existing rows from old dispositions → new analogs.
--    Old values were: no_answer, voicemail, callback, not_interested, quoted, sold, bad_number
update public.call_attempts set disposition = 'scheduled_appt'   where disposition = 'callback';
update public.call_attempts set disposition = 'dnc'              where disposition = 'not_interested';
update public.call_attempts set disposition = 'think_about_it'   where disposition = 'quoted';
-- 'no_answer' and 'voicemail' don't have direct analogs. Map them to
-- 'pick_up_hang_up' since both imply the agent failed to engage the lead.
update public.call_attempts set disposition = 'pick_up_hang_up'  where disposition in ('no_answer','voicemail');

-- 2) Drop the original check constraint
alter table public.call_attempts
  drop constraint if exists call_attempts_disposition_check;

-- 3) Add the new constraint allowing the 13 current dispositions.
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

-- 4) Update the today-stats RPC.
--    dials    = every call_attempts row today
--    contacts = any disposition where the agent actually engaged a person
--               (excludes bad_number, dnc, busy, pick_up_hang_up, exclude_all_drips)
--    sold     = disposition = 'sold'
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
