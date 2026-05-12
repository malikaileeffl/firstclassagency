-- =============================================================================
-- One-time backfill — May 2026
-- Catches the leaderboard up to the GroupMe bot's current totals as of 5/12.
-- Distributes each agent's $$$ across three timestamps so they bucket
-- correctly into the Day / Week / Month tabs of the portal leaderboard.
--
-- TIMESTAMPS (America/New_York, May 2026 = EDT, UTC-4):
--   2026-05-12 12:00 ET  → "today" entries (shows in Day, Week, Month)
--   2026-05-11 12:00 ET  → "earlier this week" entries (Week + Month)
--   2026-05-05 12:00 ET  → "earlier this month" entries (Month only)
--
-- All rows use carrier='BACKFILL' and groupme_message_id prefix='backfill_'
-- so they're easy to find/delete later. Idempotent — re-running silently
-- skips duplicates because groupme_message_id is unique.
-- =============================================================================

insert into public.leaderboard_entries
  (groupme_message_id, sender_name, amount, carrier, raw_text, posted_at)
values
  -- ===== TODAY (5/12) — from !daily =====
  ('backfill_hayden_keltner_day',   'Hayden Keltner',  1847.00,    'BACKFILL', '$1847 BACKFILL',    '2026-05-12 12:00:00-04'),
  ('backfill_colby_whittaker_day',  'Colby Whittaker',  912.00,    'BACKFILL', '$912 BACKFILL',     '2026-05-12 12:00:00-04'),

  -- ===== EARLIER THIS WEEK (5/11) — weekly minus daily =====
  ('backfill_hayden_keltner_week',  'Hayden Keltner',  7856.00,    'BACKFILL', '$7856 BACKFILL',    '2026-05-11 12:00:00-04'),
  ('backfill_garrett_week',         'Garrett',         3601.00,    'BACKFILL', '$3601 BACKFILL',    '2026-05-11 12:00:00-04'),
  ('backfill_sawyer_wetzel_week',   'Sawyer Wetzel',   3492.00,    'BACKFILL', '$3492 BACKFILL',    '2026-05-11 12:00:00-04'),
  ('backfill_marco_ayala_week',     'Marco Ayala',     3000.00,    'BACKFILL', '$3000 BACKFILL',    '2026-05-11 12:00:00-04'),
  ('backfill_matt_stewart_week',    'Matt Stewart',    1800.00,    'BACKFILL', '$1800 BACKFILL',    '2026-05-11 12:00:00-04'),
  ('backfill_seth_cordial_week',    'Seth Cordial',    1094.00,    'BACKFILL', '$1094 BACKFILL',    '2026-05-11 12:00:00-04'),
  ('backfill_justin_bailey_week',   'Justin Bailey',    650.00,    'BACKFILL', '$650 BACKFILL',     '2026-05-11 12:00:00-04'),

  -- ===== EARLIER THIS MONTH (5/05) — monthly minus weekly =====
  ('backfill_hayden_keltner_month', 'Hayden Keltner', 15483.00,    'BACKFILL', '$15483 BACKFILL',   '2026-05-05 12:00:00-04'),
  ('backfill_garrett_month',        'Garrett',        12093.00,    'BACKFILL', '$12093 BACKFILL',   '2026-05-05 12:00:00-04'),
  ('backfill_zach_schmidt_month',   'Zach Schmidt',   13884.00,    'BACKFILL', '$13884 BACKFILL',   '2026-05-05 12:00:00-04'),
  ('backfill_matt_stewart_month',   'Matt Stewart',    8988.00,    'BACKFILL', '$8988 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_marco_ayala_month',    'Marco Ayala',     7200.00,    'BACKFILL', '$7200 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_drew_smith_month',     'Drew Smith',      8916.00,    'BACKFILL', '$8916 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_seth_cordial_month',   'Seth Cordial',    6481.00,    'BACKFILL', '$6481 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_angello_salazar_month','Angello Salazar', 7075.00,    'BACKFILL', '$7075 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_xander_gundersen_month','Xander Gundersen',6840.00,   'BACKFILL', '$6840 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_justin_bailey_month',  'Justin Bailey',   5426.00,    'BACKFILL', '$5426 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_henry_raiche_month',   'henry raiche',    5567.00,    'BACKFILL', '$5567 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_jensin_philpott_month','Jensin Philpott', 4818.00,    'BACKFILL', '$4818 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_colby_whittaker_month','Colby Whittaker', 3468.00,    'BACKFILL', '$3468 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_dakota_mullis_month',  'Dakota Mullis',   3468.00,    'BACKFILL', '$3468 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_gabe_lucas_month',     'Gabe Lucas',      3235.00,    'BACKFILL', '$3235 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_levi_mayfield_month',  'Levi Mayfield',   3216.00,    'BACKFILL', '$3216 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_logan_laughlin_month', 'Logan Laughlin',  2422.98,    'BACKFILL', '$2422.98 BACKFILL', '2026-05-05 12:00:00-04'),
  ('backfill_alex_newton_month',    'Alex Newton',     2400.00,    'BACKFILL', '$2400 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_thomas_mercer_month',  'Thomas Mercer',   2307.00,    'BACKFILL', '$2307 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_austin_roberts_month', 'Austin Roberts',  2160.00,    'BACKFILL', '$2160 BACKFILL',    '2026-05-05 12:00:00-04'),
  ('backfill_timothy_tsikirai_month','Timothy Tsikirai',1738.80,   'BACKFILL', '$1738.80 BACKFILL', '2026-05-05 12:00:00-04')
on conflict (groupme_message_id) do nothing;

-- =============================================================================
-- VERIFY — paste these queries separately to spot-check
-- =============================================================================
-- Top monthly totals after backfill:
--   select sender_name, sum(amount) as monthly
--   from public.leaderboard_entries
--   where (posted_at at time zone 'America/New_York') >= '2026-05-01'
--   group by sender_name order by monthly desc;
--
-- Backfill rows only (to delete later if needed):
--   select * from public.leaderboard_entries where carrier = 'BACKFILL';
--   -- delete from public.leaderboard_entries where carrier = 'BACKFILL';
-- =============================================================================
