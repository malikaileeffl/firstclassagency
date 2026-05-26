# Portal Clone Recipe — First Class Agency Agent Portal

> A condensed reference for duplicating this agent portal for a new brand.
> For the full step-by-step build, see **Build-Instructions.pdf** in this folder.

---

## What this is

A white-labelable **insurance-agency portal + CRM**. Built so it can be cloned for other
brands by swapping brand variables and assets and standing up a fresh backend.

---

## Stack

- **Frontend:** static HTML/CSS/JS, no framework, no build step. Hosted on **GitHub Pages**
  with a custom domain via the `CNAME` file.
- **Backend:** **Supabase** — Postgres + Auth + Row-Level Security + Edge Functions (Deno).
- **Payments:** **Stripe** — Payment Element (inline card UI) + webhooks. Edge functions
  `create-payment-intent`, `stripe-webhook`.
- **Telephony (planned):** **Twilio** Voice + SMS; A2P 10DLC for SMS. Power Dialer engine
  currently mocked in the UI.
- **Leaderboard feed:** **GroupMe** group chat → `groupme-webhook` edge function parses
  "$NNNN CARRIER" messages.
- **Lead ingest:** `leads-webhook-ingest` edge function + per-agent token; Google Sheets
  Apps Script `onChange` pushes rows.
- **PWA:** `manifest.webmanifest` + icons in `assets/img/`.

---

## What to swap for a new brand (the reskin layer)

1. **Brand colors** — single source of truth is the `:root` block at the top of
   `assets/css/styles.css`. FC uses `--accent: #0078ab`, `--bg-1: #1e1e1e`, white text.
   Full dark + light theme variable set. Change the variables, the whole site reskins.
2. **Logo + assets** — `assets/img/logo.png`, `favicon.svg`, `apple-touch-icon.png`,
   `icon-192/512*.png`, plus content images (`top-writer.png`, `team-call.jpg`,
   `agency-record.jpg`).
3. **Domain** — `CNAME` file (FC = `agents.firstclassagency.info`) + DNS + GitHub Pages
   custom domain setting.
4. **Manifest** — name / short_name / theme_color in `manifest.webmanifest`.
5. **Copy / brand name** — "First Class · Agent" header text, page titles, README.

---

## Backend that must be re-created per brand (not copyable as files)

- New **Supabase project** → new project URL + publishable key (hardcoded in
  `assets/js/agent-auth.js` as `SUPABASE_URL` / `SUPABASE_KEY`). Each brand has its own
  keys — never reuse FC's.
- Run the SQL migrations in `supabase/` **in numeric order**, starting with
  `onboarding-setup.sql`, then `02-…` through `26-…`. Each is idempotent.
- New **Stripe account** → keys as edge-function secrets; configure the webhook endpoint.
- New **Twilio account** (when voice/SMS goes live).
- New **GroupMe bot** pointed at `groupme-webhook` for the leaderboard.
- Deploy edge functions: `supabase functions deploy <name> --no-verify-jwt`
  (the webhook ones must skip JWT verification).

---

## Structure facts

- **16 agent pages** in `agent/` — dashboard, training, dialer (= CRM), power-dialer,
  messages, team, settings, account, leaderboard, portals, quick-links, resources,
  promotion, carriers, builders, admin.
- **8 shared JS modules** in `assets/js/` — agent-auth, theme, main, ranks,
  training-schedule, credits-pause, money-explosion, gate-particles.
- **Single stylesheet** — `assets/css/styles.css`.
- **27 SQL files** in `supabase/` — `onboarding-setup.sql` + 26 numbered migrations.
- **4 edge functions** — create-payment-intent, stripe-webhook, groupme-webhook,
  leads-webhook-ingest.
- Training schedule is data-driven from `assets/js/training-schedule.js`
  (`window.FCA_SCHEDULE`).

---

## Quick clone checklist

1. Duplicate the repo; set new `CNAME` + DNS.
2. Edit `:root` color tokens in `styles.css`.
3. Replace all `assets/img` files (logo, favicon, PWA icons, imagery).
4. Update `manifest.webmanifest` + header brand text + titles.
5. New Supabase project → put URL + publishable key in `agent-auth.js`.
6. Run `onboarding-setup.sql` then migrations `02`–`26` in order.
7. New Stripe account → set edge-function secrets + webhook endpoint.
8. New GroupMe bot → point at `groupme-webhook`.
9. Deploy all 4 edge functions (webhooks with `--no-verify-jwt`).
10. Provision the first admin/super_admin account; invite agents.
11. Hand each agent their lead-webhook URL (or set up their Google Sheet Apps Script).

> **Never reuse another brand's Supabase, Stripe, or Twilio keys.** Each clone is a
> completely separate backend; only the frontend code and SQL migrations are shared.
