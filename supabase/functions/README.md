# Supabase Edge Functions — First Class Agency

Two edge functions power the agent prepaid-credit system:

## `create-payment-intent`
Frontend (dialer Billing tab) calls this when an agent clicks a top-up amount.
Returns a Stripe `client_secret` that the inline Payment Element mounts against.

## `stripe-webhook`
Stripe calls this endpoint on `payment_intent.succeeded` and `charge.dispute.created`.
Updates the agent's `credit_balance_cents` and writes a ledger entry.

---

## Deployment

You need the Supabase CLI installed (`brew install supabase/tap/supabase`),
and to be linked to the project (`supabase link --project-ref <ref>`).

### 1. Set the secrets

Either via the Supabase dashboard (Project Settings → Edge Functions → Secrets)
or via CLI:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...   # added after step 4 below
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
auto-injected by Supabase — no need to set them.

### 2. Deploy `create-payment-intent`

```bash
supabase functions deploy create-payment-intent
```

This one requires the caller to be a logged-in user — Supabase will verify
the JWT before invoking.

### 3. Deploy `stripe-webhook`

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

The `--no-verify-jwt` flag is critical. Stripe doesn't send a Supabase JWT;
we verify the request authenticity ourselves using Stripe's webhook signature.

### 4. Add the webhook endpoint in Stripe

In the Stripe dashboard:
- Developers → Webhooks → **Add endpoint**
- Endpoint URL: `https://<your-project-ref>.functions.supabase.co/stripe-webhook`
- Events to send:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.dispute.created`
- Click **Add endpoint**, then on the endpoint detail page click **Reveal**
  next to the signing secret. Copy that `whsec_...` value.
- Run `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...` with that value.

### 5. Re-deploy stripe-webhook after the secret is set

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

(Edge functions pick up new secrets on next invocation, but re-deploying
forces a cold start so you can verify it works.)

---

## Testing

Use Stripe's test cards in test mode (publishable key starts with `pk_test_`):

| Card                         | Behavior                  |
|------------------------------|---------------------------|
| 4242 4242 4242 4242          | Always succeeds           |
| 4000 0027 6000 3184          | Requires 3D Secure auth   |
| 4000 0000 0000 9995          | Always declines (insufficient funds) |
| 4000 0000 0000 0259          | Triggers a dispute        |

Any future expiration date, any CVC, any postal code.

After a successful test charge:
1. Check the agent's `profiles.credit_balance_cents` — should have increased
2. Check `credit_transactions` — new row with kind `'topup'`
3. Stripe dashboard → Payments — the test charge should appear
4. Stripe dashboard → Events — `payment_intent.succeeded` should show
   "Pending" briefly then "Delivered" once the webhook lands

## Going live

When ready:
1. In Stripe dashboard, flip from Test mode to Live mode
2. Create a new webhook endpoint pointing at the same Supabase URL (live mode
   webhooks are separate from test mode webhooks)
3. Update both secrets to live values:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_<from new live endpoint>
   ```
4. Swap the `STRIPE_PUBLISHABLE_KEY` constant in
   `agent/dialer.html` from `pk_test_...` to `pk_live_...`
5. Re-deploy both functions
6. Push the dialer.html change to GitHub Pages
