// Supabase edge function: stripe-webhook
// Receives webhook events from Stripe and updates agent credit balances + ledger.
//
// Events handled:
//   - payment_intent.succeeded         → add credits, save card metadata
//   - payment_intent.payment_failed    → log failure (no balance change)
//   - charge.dispute.created           → freeze account, log chargeback
//
// Deploy (MUST disable JWT verification — Stripe doesn't send a JWT):
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Required secrets:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET     (whsec_..., from Stripe webhook endpoint setup)
//   SUPABASE_URL              (auto-set)
//   SUPABASE_SERVICE_ROLE_KEY (auto-set)

import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
  } catch (e) {
    console.error('[webhook] signature invalid:', e);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.warn(`[webhook] payment failed: ${pi.id} for ${pi.metadata?.agent_id}`);
        break;
      }
      case 'charge.dispute.created': {
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;
      }
      default:
        // Quietly ignore everything else
        break;
    }
  } catch (e) {
    console.error(`[webhook] handler error on ${event.type}:`, e);
    return new Response('Handler error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
});

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
  const agentId = pi.metadata?.agent_id;
  const purpose = pi.metadata?.purpose;
  const kind    = pi.metadata?.kind || 'topup';
  if (!agentId || purpose !== 'credit_topup') return;

  // Idempotency: don't credit the same PaymentIntent twice
  const { data: existing } = await sb.from('credit_transactions')
    .select('id')
    .eq('stripe_payment_intent_id', pi.id)
    .maybeSingle();
  if (existing) {
    console.log(`[webhook] PI ${pi.id} already processed`);
    return;
  }

  // Read current balance
  const { data: profile, error: pErr } = await sb.from('profiles')
    .select('credit_balance_cents')
    .eq('id', agentId)
    .single();
  if (pErr) throw pErr;

  const newBalance = (profile?.credit_balance_cents || 0) + pi.amount;

  // Update profile balance
  const { error: uErr } = await sb.from('profiles')
    .update({ credit_balance_cents: newBalance })
    .eq('id', agentId);
  if (uErr) throw uErr;

  // If a payment method was attached, save its card info for auto-recharge
  let last4 = '';
  if (pi.payment_method && typeof pi.payment_method === 'string') {
    try {
      const pm = await stripe.paymentMethods.retrieve(pi.payment_method);
      if (pm.card) {
        last4 = pm.card.last4 ?? '';
        await sb.from('profiles').update({
          stripe_payment_method_id: pm.id,
          stripe_card_brand:        pm.card.brand,
          stripe_card_last4:        pm.card.last4,
          stripe_card_exp_month:    pm.card.exp_month,
          stripe_card_exp_year:     pm.card.exp_year,
        }).eq('id', agentId);
      }
    } catch (e) {
      console.warn('[webhook] could not fetch payment method:', e);
    }
  }

  // Insert ledger entry
  const desc = last4
    ? `Top-up via card ending ${last4}`
    : 'Credit top-up';
  await sb.from('credit_transactions').insert({
    agent_id:                 agentId,
    amount_cents:             pi.amount,
    kind,
    description:              desc,
    balance_after_c:          newBalance,
    stripe_payment_intent_id: pi.id,
  });

  console.log(`[webhook] credited $${(pi.amount / 100).toFixed(2)} to ${agentId} → balance $${(newBalance / 100).toFixed(2)}`);
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  if (!dispute.payment_intent || typeof dispute.payment_intent !== 'string') return;
  const pi = await stripe.paymentIntents.retrieve(dispute.payment_intent);
  const agentId = pi.metadata?.agent_id;
  if (!agentId) return;

  // Freeze the account
  await sb.from('profiles')
    .update({ billing_frozen: true })
    .eq('id', agentId);

  // Read current balance to record the reversal
  const { data: profile } = await sb.from('profiles')
    .select('credit_balance_cents')
    .eq('id', agentId)
    .single();
  const balanceAfter = Math.max(0, (profile?.credit_balance_cents || 0) - pi.amount);

  // Reverse the credit
  await sb.from('profiles')
    .update({ credit_balance_cents: balanceAfter })
    .eq('id', agentId);

  await sb.from('credit_transactions').insert({
    agent_id:                 agentId,
    amount_cents:             -pi.amount,
    kind:                     'chargeback',
    description:              'Chargeback dispute opened — account frozen',
    balance_after_c:          balanceAfter,
    stripe_payment_intent_id: pi.id,
    metadata:                 { dispute_id: dispute.id, reason: dispute.reason },
  });

  console.warn(`[webhook] dispute opened on ${pi.id} ($${(pi.amount / 100).toFixed(2)}) — agent ${agentId} frozen`);
}
