-- =============================================================================
-- First Class Agency — Agent billing / prepaid credits
-- Run AFTER 14-dialer-settings.sql.
-- Adds the columns + ledger table that back the dialer Billing tab.
-- Idempotent — safe to re-run.
-- =============================================================================

-- Profile-level billing state ------------------------------------------------
alter table public.profiles
  add column if not exists credit_balance_cents       integer     not null default 0,
  add column if not exists stripe_customer_id         text,
  add column if not exists stripe_payment_method_id   text,         -- saved card
  add column if not exists stripe_card_brand          text,         -- 'visa' | 'mastercard' | ...
  add column if not exists stripe_card_last4          text,
  add column if not exists stripe_card_exp_month      smallint,
  add column if not exists stripe_card_exp_year       smallint,
  add column if not exists auto_recharge_enabled      boolean     not null default false,
  add column if not exists auto_recharge_threshold_c  integer     not null default 1000,  -- $10.00
  add column if not exists auto_recharge_amount_c     integer     not null default 5000,  -- $50.00
  add column if not exists twilio_phone_number        text,         -- e.g. '+18125551234'
  add column if not exists twilio_number_purchased_at timestamptz,
  add column if not exists billing_frozen             boolean     not null default false; -- flipped on chargeback

-- Append-only ledger of every credit & debit --------------------------------
create table if not exists public.credit_transactions (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid        not null references public.profiles(id) on delete cascade,
  amount_cents    integer     not null,             -- positive = credit, negative = debit
  kind            text        not null,             -- 'topup' | 'auto_topup' | 'refund' |
                                                    -- 'sms_out' | 'sms_in' | 'voice_out' | 'voice_in' |
                                                    -- 'number_rental' | 'adjustment' | 'chargeback'
  description     text,
  balance_after_c integer     not null,             -- snapshot for audit
  stripe_payment_intent_id text,
  twilio_sid      text,                             -- message SID or call SID
  metadata        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_credit_tx_agent_created on public.credit_transactions (agent_id, created_at desc);
create index if not exists idx_credit_tx_kind         on public.credit_transactions (kind);

alter table public.credit_transactions enable row level security;

-- Agents see their own transactions; admins see everything.
drop policy if exists "credit_tx_self_read" on public.credit_transactions;
create policy "credit_tx_self_read" on public.credit_transactions
  for select using (agent_id = auth.uid() or public.is_admin());

-- Inserts come only from edge functions (service role bypasses RLS), so we
-- block client-side inserts/updates/deletes entirely.
drop policy if exists "credit_tx_no_client_write" on public.credit_transactions;
create policy "credit_tx_no_client_write" on public.credit_transactions
  for insert with check (false);
