# Rank system setup

The premium rank ladder is a frontend system that reads from your existing `leaderboard_entries` table. One SQL helper, two RPCs, no edge function needed.

## 1) Run the SQL

In **Supabase SQL Editor**, paste and run [`supabase/08-rank-helpers.sql`](08-rank-helpers.sql). Adds:

- `get_lifetime_premiums()` — returns every agent's lifetime total. Used by the leaderboard to attach rank pills.
- `get_my_lifetime_premium(p_name)` — returns one agent's lifetime total. Used by the dashboard rank widget.

## 2) Push the frontend

That's it. The rank system is purely client-side:

- `assets/js/ranks.js` — 16-rank ladder + emblem SVG generator + rank-up modal
- Dashboard rank widget at the top of `agent/dashboard.html`
- Rank pills on every row of `agent/leaderboard.html`
- Rank-up celebration fires the first time an agent loads the dashboard after climbing

## How names get matched

The rank system matches the signed-in agent to their leaderboard rows by **comparing their portal `full_name` against the GroupMe `sender_name`** (case-insensitive).

If an agent's portal name doesn't match what they post under in GroupMe, they'll show as Bronze IV with $0 lifetime. Fix: update their portal name in **account settings** to match.

For showing pills on the leaderboard, the same name match is used per row.

## Adjusting thresholds later

Single source of truth is the `RANKS` array at the top of `assets/js/ranks.js`. Edit the `min` values to retune. No server change needed.
