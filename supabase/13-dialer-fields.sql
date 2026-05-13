-- =============================================================================
-- First Class Agency — Dialer v2 field additions
-- Run AFTER 12-crm-leads.sql.
-- Adds the new metadata columns the list-view dialer needs.
-- Idempotent — safe to re-run.
-- =============================================================================

alter table public.leads
  add column if not exists received_at        timestamptz,
  add column if not exists lead_vendor        text,
  add column if not exists quote_amount       numeric(10,2),
  add column if not exists sale_amount        numeric(10,2),
  add column if not exists commission         numeric(10,2),
  add column if not exists cost_for_lead      numeric(10,2),
  add column if not exists coverage_goal      text,
  add column if not exists custom_fields      jsonb       not null default '{}'::jsonb,
  add column if not exists sms_drip_enabled   boolean     not null default true,
  add column if not exists email_drip_enabled boolean     not null default false,
  add column if not exists last_sms_sent_at   timestamptz;

-- Index for filtering by sale stage + sorting by callback time
create index if not exists idx_leads_agent_created on public.leads (agent_id, created_at desc);
