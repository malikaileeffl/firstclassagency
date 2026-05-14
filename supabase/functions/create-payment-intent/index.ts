// Supabase edge function: create-payment-intent
// Creates a Stripe PaymentIntent for the authenticated agent to top up credits.
// Frontend calls this when the agent clicks a top-up amount; we hand back a
// client_secret that the Payment Element uses to render the inline card form.
//
// Deploy:
//   supabase functions deploy create-payment-intent --no-verify-jwt=false
// Required secrets (set in Supabase dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY        (sk_test_... or sk_live_...)
//   SUPABASE_URL             (auto-set)
//   SUPABASE_ANON_KEY        (auto-set)
//   SUPABASE_SERVICE_ROLE_KEY (auto-set)

import Stripe from 'npm:stripe@17';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { amount_cents } = await req.json();
    if (!amount_cents || typeof amount_cents !== 'number') {
      return json({ error: 'amount_cents required' }, 400);
    }
    if (amount_cents < 1000 || amount_cents > 100000) {
      return json({ error: 'Amount must be between $10 and $1,000' }, 400);
    }

    // Verify the calling user via their JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No auth header' }, 401);

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    // Use service role for profile read/write
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: profile, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, stripe_customer_id, billing_frozen')
      .eq('id', user.id)
      .maybeSingle();
    if (pErr) return json({ error: 'Profile lookup failed: ' + pErr.message }, 500);
    if (!profile) return json({ error: 'Profile not found' }, 404);
    if (profile.billing_frozen) {
      return json({ error: 'Billing is frozen on this account. Contact support.' }, 403);
    }

    // Find or create the Stripe customer
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name:  profile.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Create the PaymentIntent — cards only.
    // setup_future_usage at the card level (not top level) saves the card
    // for auto-recharge while keeping Stripe Link's SMS signup out of the form.
    const pi = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: 'usd',
      customer: customerId,
      payment_method_types: ['card'],
      payment_method_options: {
        card: { setup_future_usage: 'off_session' },
      },
      description: `First Class Agent credits — ${(amount_cents / 100).toFixed(2)} USD`,
      metadata: {
        agent_id: user.id,
        purpose:  'credit_topup',
        kind:     'topup',
      },
    });

    return json({
      client_secret:     pi.client_secret,
      payment_intent_id: pi.id,
    }, 200);
  } catch (e) {
    console.error('[create-payment-intent] error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
