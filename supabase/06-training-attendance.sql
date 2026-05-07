-- =============================================================================
-- First Class Agency — training-call attendance tracking
-- Run AFTER 05-admin-calendly.sql.
-- Stores per-user, per-date attendance for the daily 9 AM training calls.
-- Format: { "2026-05-04": true, "2026-05-05": true }
-- Idempotent — safe to re-run.
-- =============================================================================

alter table public.onboarding_progress
  add column if not exists training_attendance jsonb not null default '{}'::jsonb;
