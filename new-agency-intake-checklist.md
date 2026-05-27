# New Agency Portal — Intake Checklist

Fill this out before we start building. The more complete this is, the faster
your portal goes from zero to live. Anything you don't have yet, leave blank —
we can use placeholders and swap them in later.

---

## 1. Agency Identity

- **Agency name (full):** ______________________________
- **Header display text** (how it reads top-left, e.g. "First Class · Agent"): ______________________________
- **Short name** (for the phone home-screen app icon, ~12 chars): ______________________________
- **One-line description** (used in the app manifest): ______________________________

---

## 2. Brand Look

- **Primary / accent color** (hex, e.g. `#0078ab`): ______________
- **Dark color** (hex, backgrounds/surfaces, e.g. `#1e1e1e`): ______________
- **Do you want a dark theme, light theme, or both?** ______________
- **Logo file:** attach a transparent **PNG** (square or horizontal — note which)
- **Favicon:** attach an **SVG** or PNG (the little browser-tab icon). If you don't have one, we'll generate it from the logo.
- **Any brand fonts you must use?** (default is Inter + JetBrains Mono): ______________

---

## 3. Domain & Hosting

- **Desired domain** (e.g. `agents.youragency.com`): ______________________________
- **Who controls the domain's DNS?** (you / a web person / not purchased yet): ______________________________
- **GitHub account** that will own the repo (username/email): ______________________________

> Note: each portal is its own GitHub repo + its own domain. You'll need a (free) GitHub account and access to the domain's DNS settings.

---

## 4. Content to Drop In

- **Weekly training schedule** (5 calls, Mon–Fri — topic + host for each):
  - Mon: ______________________________
  - Tue: ______________________________
  - Wed: ______________________________
  - Thu: ______________________________
  - Fri: ______________________________
- **Lead types** the agency works (e.g. Trucker IUL, Gen Life, Veteran): ______________________________
- **Photos** for the dashboard (top writer, team call, agency record) — attach or note "use placeholders for now"
- **Carrier / portal links** they want in the Quick Links & E-apps pages: ______________________________

---

## 5. Backend Accounts (the agency owner sets these up — they're per-agency)

Each portal needs its own backend. Check off as these are created; share keys with me when ready.

- [ ] **Supabase** project created → I'll need the **Project URL** + **publishable (anon) key**
- [ ] **Stripe** account (if charging agents for credits/dialer) → secret key + webhook signing secret
- [ ] **GroupMe** bot (for the leaderboard) → pointed at the leaderboard webhook
- [ ] **Twilio** account (only when voice/SMS goes live) → can be deferred
- [ ] **Google account** (for the lead auto-sync Apps Script, if using Google Sheets)

> I never reuse another agency's keys — each portal is a completely separate
> backend. Only the frontend code and the database migrations are shared.

---

## 6. Feature Scope (check what this agency wants on day one)

- [ ] Training tracking (8-week onboarding grid + attendance)
- [ ] Leaderboard (GroupMe-fed sales ranking)
- [ ] CRM (leads, click-to-call, CSV import, dispositions)
- [ ] Power Dialer paywall ($110/mo or custom)
- [ ] SMS messaging
- [ ] Prepaid billing / credits (Stripe)
- [ ] Lead auto-sync (Google Sheets / vendor webhooks)
- [ ] PWA / installable app

> We can launch with a subset and turn features on later — they're modular.

---

## 7. Pricing & Commercials (between you and the agency — not technical)

- **What are you charging them?** (build fee, monthly maintenance, per-service): ______________________________
- **Billing cadence** (weekly / monthly / quarterly): ______________________________
- **Who owns the repo and accounts long-term — you or the agency?** ______________________________

---

### Once this is filled out

Open a new project for the agency, drop this completed checklist in, and tell me
"new agency portal." I'll already know the architecture from the clone recipe —
I'll reskin the frontend, wire in the new Supabase keys, and hand you the exact
SQL + deploy steps to stand up the backend.
