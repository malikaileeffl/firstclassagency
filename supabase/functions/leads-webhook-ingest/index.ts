// Supabase edge function: leads-webhook-ingest
// Receives leads from external sources (Google Apps Script row triggers,
// Facebook Lead Ads webhooks, custom vendor pushes, etc) and inserts them
// into the authenticated agent's lead pipeline.
//
// URL shape:
//   POST /functions/v1/leads-webhook-ingest/{agent_lead_token}
//
// Accepted payloads (any of):
//   1) Apps Script row mode:
//      { "row": ["John Doe", "+15551234567", "john@x.com", ...] }
//      We try to detect the column meaning by sniffing the values
//      (phone pattern, email pattern, etc). This is intentionally forgiving
//      because lead sheets in the wild have wildly different headers.
//
//   2) Direct field mode (preferred for real vendor integrations):
//      {
//        "full_name":     "John Doe",
//        "first_name":    "John",          // optional, combined with last_name
//        "last_name":     "Doe",
//        "phone":         "+15551234567",
//        "email":         "john@x.com",
//        "state":         "TN",
//        "address":       "123 Main St",
//        "date_of_birth": "1962-04-15",
//        "lead_type":     "Trucker IUL",
//        "notes":         "Came in from FB ad #42",
//        "source":        "facebook_ads"   // optional; defaults to "webhook"
//      }
//
// Deploy (MUST disable JWT verification — external services don't send a JWT):
//   supabase functions deploy leads-webhook-ingest --no-verify-jwt

import { createClient } from 'jsr:@supabase/supabase-js@2';

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ALLOWED_LEAD_TYPES = new Set([
  'Trucker IUL',
  'Gen Life IUL',
  'Gen Life',
  'Veteran',
]);

const STATE_RE  = /^[A-Z]{2}$/i;
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE  = /^\+?1?[\s().-]?\d{3}[\s().-]?\d{3}[\s().-]?\d{4}$/;
const DOB_RE    = /^\d{4}-\d{2}-\d{2}$/;

// --- helpers ----------------------------------------------------------------

function normPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function looksLikePhone(s: string)  { return PHONE_RE.test(s.trim()); }
function looksLikeEmail(s: string)  { return EMAIL_RE.test(s.trim()); }
function looksLikeState(s: string)  { return STATE_RE.test(s.trim()); }
function looksLikeDob(s: string)    { return DOB_RE.test(s.trim()); }

// Sniff a generic row of arbitrary columns into our lead shape.
// Used as a fallback when no headers are provided (or all headers are unknown).
function sniffRow(row: any[]): Record<string, any> {
  const out: Record<string, any> = {};
  const remaining: string[] = [];

  for (const cell of row) {
    const v = String(cell ?? '').trim();
    if (!v) continue;
    if (!out.email   && looksLikeEmail(v))  { out.email   = v.toLowerCase(); continue; }
    if (!out.phone   && looksLikePhone(v))  { out.phone   = normPhone(v);    continue; }
    if (!out.state   && looksLikeState(v))  { out.state   = v.toUpperCase(); continue; }
    if (!out.dob     && looksLikeDob(v))    { out.dob     = v;               continue; }
    remaining.push(v);
  }
  // First remaining string that contains a space → full name guess
  if (remaining.length) {
    const named = remaining.find(s => / /.test(s));
    out.full_name = named || remaining[0];
  }
  return out;
}

// Map a free-form header (sheet column label) to one of our canonical fields.
// Accepts a wide variety of common spellings/casings. Returns null when the
// header doesn't look like anything we recognize (so we don't accidentally
// stuff random data into the wrong field).
function canonicalField(rawHeader: string): string | null {
  const h = String(rawHeader || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!h) return null;

  // First/last name — check BEFORE generic "name" so they win
  if (/(first ?name|first|given ?name|fname|f name)/.test(h)) return 'first_name';
  if (/(last ?name|last|sur ?name|surname|family name|lname|l name)/.test(h)) return 'last_name';

  // Full name (any of these patterns, but only if not first/last)
  if (/\b(full name|customer name|lead name|name)\b/.test(h)) return 'full_name';

  // Phone variants
  if (/\b(phone|cell|mobile|tel|contact number|primary number|phone number)\b/.test(h)) return 'phone';

  // Email
  if (/\b(e ?mail|email address)\b/.test(h)) return 'email';

  // Date of birth
  if (/(date of birth|birth ?date|dob|birthday)/.test(h)) return 'date_of_birth';

  // State / address
  if (/\bstate\b/.test(h)) return 'state';
  if (/(street|address|addr|mailing|city)/.test(h)) return 'address';

  // Lead type / product
  if (/(lead ?type|product|policy ?type)/.test(h)) return 'lead_type';

  // Notes / comments
  if (/(note|comment|details?|message)/.test(h)) return 'notes';

  // Source
  if (/(source|origin|campaign|utm|funnel)/.test(h)) return 'source';

  return null;
}

// Build the field bag from { headers, row } by mapping by header name.
// Returns the mapped fields PLUS a count of recognized headers so the
// handler can fall back to sniff if nothing matched.
function mapByHeaders(headers: any[], row: any[]): { mapped: Record<string, any>; recognized: number } {
  const out: Record<string, any> = {};
  let recognized = 0;
  headers.forEach((h, i) => {
    const field = canonicalField(String(h || ''));
    if (!field) return;
    const v = String(row[i] ?? '').trim();
    if (!v) return;
    out[field] = v;
    recognized++;
  });
  return { mapped: out, recognized };
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// --- handler ----------------------------------------------------------------

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    // Token is the LAST path segment of the URL.
    const url   = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const token = parts[parts.length - 1];
    if (!token || token === 'leads-webhook-ingest') {
      return json({ error: 'missing_token' }, 400);
    }

    // Look up the agent by token.
    const { data: profile, error: profErr } = await sb
      .from('profiles')
      .select('id, agent_lead_token, full_name')
      .eq('agent_lead_token', token)
      .maybeSingle();

    if (profErr) {
      console.error('[leads-ingest] profile lookup failed', profErr);
      return json({ error: 'lookup_failed' }, 500);
    }
    if (!profile) return json({ error: 'invalid_token' }, 403);

    // Parse body — accept JSON only.
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    // Three payload modes, in priority order:
    //   1) { headers: [...], row: [...] } — header-mapped (preferred for sheets)
    //   2) { row: [...] }                 — sniff by value pattern (fallback)
    //   3) { full_name: ..., phone: ... } — direct named fields (real vendors)
    let mapped: Record<string, any> = {};
    if (Array.isArray(body.headers) && Array.isArray(body.row)) {
      const result = mapByHeaders(body.headers, body.row);
      mapped = result.mapped;
      // If NONE of the headers were recognized, the sheet probably starts at
      // row 1 with data (no header row). Fall back to sniffing so we still
      // get phone/email/state from the values themselves.
      if (result.recognized === 0) {
        mapped = sniffRow(body.row);
      }
    } else if (Array.isArray(body.row)) {
      mapped = sniffRow(body.row);
    } else if (body && typeof body === 'object') {
      mapped = body;
    } else {
      return json({ error: 'bad_payload' }, 400);
    }

    // Normalize name + phone
    const phone = normPhone(mapped.phone);
    if (!phone) return json({ error: 'phone_required' }, 400);

    let fullName = String(mapped.full_name || '').trim();
    if (!fullName && (mapped.first_name || mapped.last_name)) {
      fullName = [mapped.first_name, mapped.last_name].filter(Boolean).join(' ').trim();
    }
    if (!fullName) fullName = 'Unknown lead';

    // Lead type — only accept known values, otherwise drop it.
    const rawType = String(mapped.lead_type || '').trim();
    const leadType = ALLOWED_LEAD_TYPES.has(rawType) ? rawType : null;

    // DOB — only accept ISO YYYY-MM-DD, otherwise drop.
    const dobRaw = String(mapped.date_of_birth || mapped.dob || '').trim();
    const dob = looksLikeDob(dobRaw) ? dobRaw : null;

    // Deduplicate — if this agent already has a lead with this phone,
    // attach a note and bail rather than creating a duplicate row.
    const { data: existing } = await sb
      .from('leads')
      .select('id, notes')
      .eq('agent_id', profile.id)
      .eq('phone', phone)
      .maybeSingle();

    if (existing) {
      const stamp = `[webhook dupe ${new Date().toISOString().slice(0, 10)}]`;
      const merged = existing.notes ? `${existing.notes}\n${stamp}` : stamp;
      await sb.from('leads').update({ notes: merged }).eq('id', existing.id);
      return json({ status: 'duplicate', lead_id: existing.id });
    }

    // Insert
    const insert: Record<string, any> = {
      agent_id:      profile.id,
      full_name:     fullName,
      phone,
      email:         (mapped.email   || null)?.toString().trim().toLowerCase() || null,
      address:       (mapped.address || null)?.toString().trim() || null,
      state:         (mapped.state   || null)?.toString().trim().toUpperCase() || null,
      date_of_birth: dob,
      notes:         (mapped.notes   || null)?.toString().trim() || null,
      lead_type:     leadType,
      stage:         'new',
      source:        (mapped.source  || 'webhook').toString().trim().toLowerCase(),
    };

    const { data: lead, error: insErr } = await sb
      .from('leads')
      .insert(insert)
      .select('id')
      .single();

    if (insErr) {
      console.error('[leads-ingest] insert failed', insErr);
      return json({ error: 'insert_failed', detail: insErr.message }, 500);
    }

    return json({ status: 'created', lead_id: lead.id });

  } catch (err) {
    console.error('[leads-ingest] unhandled', err);
    return json({ error: 'server_error' }, 500);
  }
});
