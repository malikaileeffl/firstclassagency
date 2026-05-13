-- =============================================================================
-- First Class Agency — Dialer settings on profiles
-- Run AFTER 13-dialer-fields.sql.
-- Adds a single jsonb column on profiles for all dialer settings (General +
-- whatever tabs we add later). One column keeps it flexible and avoids
-- schema migrations every time we add a setting.
-- Idempotent — safe to re-run.
-- =============================================================================

alter table public.profiles
  add column if not exists dialer_settings jsonb not null default jsonb_build_object(
    'general', jsonb_build_object(
      'forward_calls_to',  null,
      'agent_website',     null,
      'default_time_zone', 'Eastern',
      'agent_id_display',  null,
      'stop_texting_mode', 'custom',                    -- 'custom' | 'single' | 'never'
      'stop_texting_single', '20:00',                   -- HH:MM 24h if mode='single'
      'stop_texting_per_day', jsonb_build_object(       -- HH:MM 24h per weekday
        'sun', '20:00', 'mon', '20:00', 'tue', '20:00', 'wed', '20:00',
        'thu', '20:00', 'fri', '20:00', 'sat', '20:00'
      ),
      'preferences', jsonb_build_object(
        'dark_mode',           false,
        'auto_save_notes',     true,
        'keep_call_recording', false,
        'allow_availability',  false
      ),
      'system_alerts', jsonb_build_object(
        'new_lead',         true,
        'new_text',         true,
        'missed_call',      false,
        'email_opened',     false
      )
    )
  );
