/**
 * GroupMe → Supabase webhook
 *
 * GroupMe POSTs every message in the group to this URL. We:
 *   1) Verify the request came from the expected GroupMe group
 *   2) Skip bot replies, system messages, and reply-commands like "!Weekly"
 *   3) Parse messages of shape "$NNNN[.NN] CARRIER" (strict — must START with $)
 *   4) Insert a leaderboard_entries row, idempotent on groupme_message_id
 *
 * Required Supabase secrets:
 *   - SUPABASE_URL                (auto, already present)
 *   - SUPABASE_SERVICE_ROLE_KEY   (auto, already present)
 *   - GROUPME_GROUP_ID            (set this — the group whose messages we accept)
 *   - GROUPME_WEBHOOK_SECRET      (optional — extra path-token check via ?s=)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type GroupMeMessage = {
  id: string;                    // message id
  group_id: string;
  sender_id?: string;
  user_id?: string;
  sender_type: "user" | "bot" | "system" | string;
  name: string;
  text: string | null;
  created_at: number;            // unix seconds
  system?: boolean;
  attachments?: unknown[];
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPECTED_GROUP_ID = Deno.env.get("GROUPME_GROUP_ID") || "";
const WEBHOOK_SECRET   = Deno.env.get("GROUPME_WEBHOOK_SECRET") || "";

// Regex matches messages that START with "$NNNN" optionally followed by ".NN"
// and (optionally) a 2–20-char carrier abbreviation. Comma thousand-separators allowed.
//   "$1200 AMERICO"         → 1200, AMERICO
//   "$1,200 AMERICO"        → 1200, AMERICO
//   "$1200.50 MOO"          → 1200.50, MOO
//   "$1200 Mutual of Omaha" → 1200, Mutual (we only capture the first token)
//   "$1200"                 → 1200, (no carrier)
const PREMIUM_REGEX = /^\s*\$([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)(?:\s+([A-Za-z][A-Za-z0-9\-]{1,19}))?/;

// Bot reply patterns we explicitly want to skip even if a malicious user spoofs sender_type.
const BOT_REPLY_PATTERNS = [
  /^!?(daily|weekly|monthly)\s*leaderboard/i,
  /leaderboard[:\s]/i,
];

// User-issued commands we should also skip.
const COMMAND_PATTERNS = [/^\s*!(daily|weekly|monthly|help)/i];

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Optional shared-secret check via ?s=...
  if (WEBHOOK_SECRET) {
    const url = new URL(req.url);
    if (url.searchParams.get("s") !== WEBHOOK_SECRET) {
      return jsonError("bad secret", 401);
    }
  }

  let msg: GroupMeMessage;
  try {
    msg = await req.json();
  } catch {
    return jsonError("invalid json", 400);
  }

  // Verify the message is from the expected group
  if (EXPECTED_GROUP_ID && msg.group_id !== EXPECTED_GROUP_ID) {
    return jsonResult({ skipped: true, reason: "wrong group_id" });
  }

  // Skip bot replies, system messages, empty texts
  if (msg.sender_type !== "user") return jsonResult({ skipped: true, reason: "non-user sender" });
  if (msg.system === true)        return jsonResult({ skipped: true, reason: "system message" });
  if (!msg.text || !msg.text.trim()) return jsonResult({ skipped: true, reason: "empty text" });

  // Skip user commands
  if (COMMAND_PATTERNS.some((re) => re.test(msg.text!))) {
    return jsonResult({ skipped: true, reason: "command" });
  }
  // Belt-and-suspenders: skip messages that look like a leaderboard reply
  if (BOT_REPLY_PATTERNS.some((re) => re.test(msg.text!))) {
    return jsonResult({ skipped: true, reason: "looks like a leaderboard reply" });
  }

  // Parse "$NNNN CARRIER"
  const m = msg.text.match(PREMIUM_REGEX);
  if (!m) {
    return jsonResult({ skipped: true, reason: "no premium pattern" });
  }
  const amount = parseFloat(m[1].replace(/,/g, ""));
  const carrier = (m[2] || "").toUpperCase() || null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResult({ skipped: true, reason: "invalid amount" });
  }

  // Insert — idempotent via unique constraint on groupme_message_id
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await sb.from("leaderboard_entries").insert({
    groupme_message_id: msg.id,
    groupme_user_id:    msg.user_id || msg.sender_id || null,
    sender_name:        msg.name,
    amount,
    carrier,
    raw_text:           msg.text,
    posted_at:          new Date(msg.created_at * 1000).toISOString(),
  });

  if (error) {
    // Duplicate? Ignore — that's the idempotency working.
    if (error.code === "23505") {
      return jsonResult({ skipped: true, reason: "duplicate message_id" });
    }
    console.error("[groupme-webhook] insert failed:", error);
    return jsonError(error.message, 500);
  }

  return jsonResult({ inserted: true, amount, carrier, sender: msg.name });
});

function jsonResult(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
