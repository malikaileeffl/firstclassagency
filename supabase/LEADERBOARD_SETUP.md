# Leaderboard setup guide

End-to-end wiring of the GroupMe → Supabase → portal leaderboard. ~15 minutes.

## How it works

1. A bot inside your GroupMe chat sends every message to a Supabase Edge Function via webhook
2. The function parses messages of shape `$NNNN CARRIER`, skips bot replies and `!Weekly`/`!Monthly`/`!Daily` commands, and inserts into a `leaderboard_entries` table
3. The new portal page at `agent/leaderboard.html` reads from that table and ranks agents by total premium for Today / This Week / This Month
4. Messages are deduped by GroupMe message ID — replays from GroupMe can't double-count

---

## 1) Run the SQL migration

In **Supabase SQL Editor**, paste and run [`supabase/07-leaderboard.sql`](07-leaderboard.sql). Creates the `leaderboard_entries` table and the `get_leaderboard()` function.

## 2) Deploy the edge function

### Option A — Supabase dashboard

1. Supabase dashboard → **Edge Functions → Deploy a new function**
2. Name: `groupme-webhook`
3. Paste the entire contents of [`supabase/functions/groupme-webhook/index.ts`](functions/groupme-webhook/index.ts)
4. Click **Deploy function**

### Option B — CLI

```bash
supabase functions deploy groupme-webhook --project-ref YOUR_PROJECT_REF
```

Once deployed, note the function URL — it'll be:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/groupme-webhook
```

## 3) Generate a webhook secret (optional but recommended)

This stops random POSTs to your URL from being processed.

```bash
# In a terminal, generate a random token
openssl rand -hex 16
```

Save the output — you'll use it in steps 4 and 5.

## 4) Add Supabase secrets

Supabase dashboard → **Project Settings → Edge Functions → Secrets**. Add two secrets:

| Name | Value |
|---|---|
| `GROUPME_GROUP_ID` | Your GroupMe group's ID (you'll get this in step 5) |
| `GROUPME_WEBHOOK_SECRET` | The random hex string from step 3 (optional) |

> **Wait** — you don't have the group ID yet. Set this after step 5 and **redeploy the function** (or set it before deploy in step 2 if you swap the order).

## 5) Create the GroupMe bot

1. Go to https://dev.groupme.com/ and sign in with your GroupMe account
2. Click **Bots → Create Bot**
3. **Select group**: pick your wins chat
4. **Name**: `First Class Leaderboard`
5. **Callback URL**:
   - With secret (recommended): `https://YOUR_PROJECT_REF.supabase.co/functions/v1/groupme-webhook?s=YOUR_HEX_SECRET`
   - Without secret: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/groupme-webhook`
6. **Avatar URL** (optional): paste a URL to your logo
7. Click **Submit**

After it's created, you'll see two things on the bot's row:
- **Bot ID** (not needed unless you want the bot to send messages back later)
- **Group ID** — copy this and set it as the `GROUPME_GROUP_ID` secret in step 4

## 6) Test it

Post a message in your GroupMe chat:

```
$1200 AMERICO
```

Then check **Supabase → Edge Functions → groupme-webhook → Logs**. You should see a log line like:
```json
{ "inserted": true, "amount": 1200, "carrier": "AMERICO", "sender": "Your Name" }
```

And in the portal at `agents.firstclassagency.info/agent/leaderboard.html` you should see yourself on the board.

## 7) Test the filters

Try each of these in the GroupMe — none of them should appear on the leaderboard:

| Message | Why it's skipped |
|---|---|
| `!Weekly` | User command |
| `Just hit $1200!` | Doesn't start with `$NNNN CARRIER` |
| Bot's `!Weekly` reply | `sender_type` is "bot" |
| Any system message ("Sarah joined the group") | `system: true` flag |

---

## Format rules

What gets counted:
- Must START with `$` followed by a number
- Number can use commas (`$1,200`) and a decimal (`$1200.50`)
- Carrier abbreviation after a space is optional but recommended (`$1200 AMERICO`)
- Carrier capture is the first word after the amount — so `$1200 Mutual of Omaha` records carrier as just "Mutual"

What does NOT get counted:
- `1200 AMERICO` (no `$`)
- `$5 coffee mid-sentence`
- `Just got a $1200 sale!` (doesn't START with `$`)
- Bot messages or `!commands`

## Fixing typos

If someone posts the wrong amount, admins can edit or delete the row directly in Supabase: **Table Editor → leaderboard_entries**. RLS allows admins to update/delete; agents can only read.

## Cost

- Supabase Edge Functions: free up to 500K invocations/month. A chatty group at 100 posts/day = 3K/month.
- GroupMe bot: free.
- Total: $0 ongoing.
