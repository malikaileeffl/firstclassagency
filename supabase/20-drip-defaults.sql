-- =============================================================================
-- First Class Agency — Drip defaults
-- Run AFTER 19-dispositions.sql.
-- Flips email_drip_enabled to default TRUE (matching sms_drip_enabled) so leads
-- only show a "No email drips" pill when an admin/agent has explicitly opted
-- them out. Also backfills existing leads where the old default left it FALSE.
-- Idempotent — safe to re-run.
-- =============================================================================

alter table public.leads
  alter column email_drip_enabled set default true;

-- Backfill: any existing lead that's still on the old FALSE default gets
-- flipped to TRUE. If you've explicitly excluded specific leads via the
-- "Exclude From All Drips" disposition, undo this for them manually after.
update public.leads
set email_drip_enabled = true
where email_drip_enabled = false;
