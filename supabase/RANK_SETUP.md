# Rank system setup

The premium rank ladder is **monthly** — every agent's rank is computed from their **submitted premium** for the current calendar month (America/New_York), and resets on the 1st of every month. "Submitted" means the dollar amounts agents post in the GroupMe chat — these are submitted applications, not necessarily what the carrier ultimately issues. Frontend-only system that reads from your existing `leaderboard_entries` table.

## 1) Run the SQL

In **Supabase SQL Editor**, paste and run [`supabase/08-rank-helpers.sql`](08-rank-helpers.sql). Adds:

- `get_my_monthly_summary(p_name)` — returns this month, last month, personal-best month, and lifetime totals for one agent. Used by the dashboard rank widget.
- `get_current_month_premiums()` — returns every agent's current-month total. Used by the leaderboard to attach rank pills.

## 2) Push the frontend

The rank system itself is pure client-side:

- `assets/js/ranks.js` — 16-rank ladder + emblem SVG generator + rank-up modal + month-wrap modal
- Dashboard rank widget at the top of `agent/dashboard.html`
- Rank pills on every row of `agent/leaderboard.html`
- Rank-up celebration fires when an agent climbs *within* the current month
- Month-wrap modal fires once on the 1st of each month when an agent loads the dashboard, showing their final rank + premium for the previous month and whether it's a new personal best

## How names get matched

The rank system matches the signed-in agent to their `leaderboard_entries` rows by **comparing their portal `full_name` against the GroupMe `sender_name`** (case-insensitive).

If an agent's portal name doesn't match what they post under in GroupMe, they'll show as Bronze IV with $0 this month. Fix: update their portal name in **Account** to match.

For showing pills on the leaderboard, the same name match is used per row.

## Adjusting thresholds later

Single source of truth is the `RANKS` array at the top of `assets/js/ranks.js`. Edit the `min` values to retune. No server change needed.

## Current monthly thresholds

| Rank | Threshold |
|---|---|
| Bronze IV | $0 |
| Bronze III | $2,500 |
| Bronze II | $5,000 |
| Bronze I | $7,500 |
| Silver IV | $10,000 |
| Silver III | $13,000 |
| Silver II | $17,000 |
| Silver I | $21,000 |
| Gold IV | $25,000 |
| Gold III | $31,000 |
| Gold II | $37,000 |
| Gold I | $43,000 |
| Platinum III | $50,000 |
| Platinum II | $66,000 |
| Platinum I | $83,000 |
| **Champion** | **$100,000+** |
