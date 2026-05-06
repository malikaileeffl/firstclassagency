-- =============================================================================
-- First Class Agency — add per-task progress tracking
-- Run AFTER 03-weeks-redesign.sql.
-- Adds a jsonb column that maps week number → array of checked task indexes,
-- so each agent's in-progress checklist persists between sessions.
--   Example: { "1": [0, 1, 2], "2": [0] }
-- The week is fully complete only when its task array length equals the
-- number of tasks defined for that week in the training page JS.
-- Idempotent — safe to re-run.
-- =============================================================================

alter table public.onboarding_progress
  add column if not exists task_progress jsonb not null default '{}'::jsonb;
