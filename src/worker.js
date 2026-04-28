// Keystone chatbot Worker.
//
// Routes:
//   POST /api/chat  - proxy a turn to Anthropic, return reply + parsed lead.
//   POST /api/lead  - persist lead to KV, score it, email + webhook.
//   *               - fall through to static assets via env.ASSETS.fetch().
//
// Conversation state lives in the browser. Each /api/chat call sends the
// full message history; the worker is stateless except for KV writes
// (transcript per session, lead per capture).

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const RESEND_URL = 'https://api.resend.com/emails';
const TRANSCRIPT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// ---- security limits ------------------------------------------------------
const MAX_BODY_BYTES = 32 * 1024;       // reject any request body over 32 KB
const MAX_MESSAGES = 80;                // soft cap; longer histories get trimmed
const MAX_CHARS_PER_MESSAGE = 1500;     // cap individual message size
const MAX_OUTPUT_TOKENS = 512;          // cap Anthropic reply length
const ALLOWED_ORIGINS = new Set([
  'https://keystone-website.keystonetech.workers.dev',
  'https://keystonetech.ca',
  'https://www.keystonetech.ca',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
]);

// Lead-field allow-lists (must mirror the system prompt's allowed values)
const SEAT_BUCKETS = ['1-10', '11-25', '26-75', '76-150', '150+'];
const TIMELINES = ['ASAP', '30 days', 'this quarter', 'researching'];
const CURRENT_IT = ['in-house', 'another MSP', 'nothing formal', 'not sure'];
const PROSPECT_CATS = ['security', 'managed', 'voip', 'cloud', 'hardware', 'broken', 'just_looking'];
const CLIENT_CATS = ['client_urgent', 'client_general'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env, ctx);
    }
    if (url.pathname === '/api/lead' && request.method === 'POST') {
      return handleLead(request, env, ctx);
    }

    // Everything else is the static site.
    return env.ASSETS.fetch(request);
  },
};

// -------------------------------------------------------------- /api/chat

async function handleChat(request, env, ctx) {
  if (!checkOrigin(request)) return jsonError(403, 'forbidden_origin');
  if (!withinSizeLimit(request)) return jsonError(413, 'too_large');

  const ip = clientIp(request);
  if (env.CHAT_RL) {
    const { success } = await env.CHAT_RL.limit({ key: ip });
    if (!success) return jsonError(429, 'rate_limited');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_json');
  }

  const messages = Array.isArray(body.messages) ? body.messages : null;
  const sessionId = typeof body.session_id === 'string' && UUID_RE.test(body.session_id) ? body.session_id : null;
  const page = typeof body.page === 'string' ? body.page.slice(0, 32) : 'unknown';

  if (!messages || !sessionId) {
    return jsonError(400, 'missing_fields');
  }

  // Soft-trim long histories so a chatty visitor doesn't get a hard error.
  // Keep the most recent MAX_MESSAGES, and ensure the trimmed array starts
  // with a user turn (Anthropic requires user/assistant alternation).
  let convo = messages;
  if (convo.length > MAX_MESSAGES) {
    convo = convo.slice(-MAX_MESSAGES);
    if (convo[0]?.role === 'assistant') convo = convo.slice(1);
  }

  const systemPrompt = buildSystemPrompt({
    page,
    businessHours: env.BUSINESS_HOURS,
    nowIso: new Date().toISOString(),
    inBusinessHours: isBusinessHours(new Date()),
  });

  const apiResp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemPrompt,
      messages: convo.map(sanitizeMessage),
    }),
  });

  if (!apiResp.ok) {
    const detail = await apiResp.text();
    console.error('anthropic_error', apiResp.status, detail);
    return jsonError(502, 'upstream_error');
  }

  const data = await apiResp.json();
  const rawReply = extractText(data);
  const { displayText, lead } = splitLeadBlock(rawReply);

  // Fire-and-forget transcript persistence (don't block the response).
  ctx.waitUntil(saveTranscript(env, sessionId, page, messages, displayText));

  return Response.json({ reply: displayText, lead });
}

function sanitizeMessage(m) {
  const role = m.role === 'assistant' ? 'assistant' : 'user';
  const content = typeof m.content === 'string' ? m.content.slice(0, MAX_CHARS_PER_MESSAGE) : '';
  return { role, content };
}

function extractText(anthropicResponse) {
  const blocks = anthropicResponse?.content || [];
  return blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

// Bot signals "lead captured" by ending its message with:
//   <<<lead>>>{ ... json ... }<<<end>>>
// We strip the block from what the user sees and parse the JSON.
function splitLeadBlock(text) {
  const re = /<<<lead>>>([\s\S]*?)<<<end>>>/;
  const match = text.match(re);
  if (!match) return { displayText: text, lead: null };

  const display = text.replace(re, '').trim();
  let lead = null;
  try {
    lead = JSON.parse(match[1].trim());
  } catch {
    console.error('lead_parse_failed', match[1]);
  }
  return { displayText: display, lead };
}

async function saveTranscript(env, sessionId, page, messages, latestReply) {
  const key = `transcript:${sessionId}`;
  const value = JSON.stringify({
    session_id: sessionId,
    page,
    updated_at: new Date().toISOString(),
    messages: [...messages, { role: 'assistant', content: latestReply }],
  });
  try {
    await env.CHAT_KV.put(key, value, { expirationTtl: TRANSCRIPT_TTL_SECONDS });
  } catch (err) {
    console.error('transcript_save_failed', err.message);
  }
}

// -------------------------------------------------------------- /api/lead

async function handleLead(request, env, ctx) {
  if (!checkOrigin(request)) return jsonError(403, 'forbidden_origin');
  if (!withinSizeLimit(request)) return jsonError(413, 'too_large');

  const ip = clientIp(request);
  if (env.LEAD_RL) {
    const { success } = await env.LEAD_RL.limit({ key: ip });
    if (!success) return jsonError(429, 'rate_limited');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_json');
  }

  const sessionId = typeof body.session_id === 'string' && UUID_RE.test(body.session_id) ? body.session_id : null;
  const lead = body.lead;
  if (!lead || !sessionId) return jsonError(400, 'missing_fields');

  const validationError = validateLead(lead);
  if (validationError) {
    console.warn('lead_rejected', validationError);
    return jsonError(400, validationError);
  }

  const score = scoreLead(lead);
  const enriched = {
    ...lead,
    score,
    session_id: sessionId,
    captured_at: new Date().toISOString(),
  };

  const ts = Date.now();
  const key = `lead:${ts}-${sessionId}`;

  // Persist before sending notifications so we never lose a lead even if
  // email/webhook fail.
  try {
    await env.CHAT_KV.put(key, JSON.stringify(enriched));
  } catch (err) {
    console.error('lead_save_failed', err.message);
    return jsonError(500, 'storage_failed');
  }

  // Notifications can be slow / flaky; don't block the user's UI.
  ctx.waitUntil(notifyLead(env, enriched));

  return Response.json({ ok: true, score });
}

function scoreLead(lead) {
  if (lead.type === 'client') {
    return lead.category === 'client_urgent' ? 'urgent' : 'standard';
  }

  const seats = lead.seats;
  const timeline = lead.timeline;
  const category = lead.category;

  // Out-of-ICP: very large or break-fix only
  if (seats === '150+' || category === 'broken') return 'referral';

  // ICP-fit seat counts
  const icpSeats = ['11-25', '26-75', '76-150'].includes(seats);
  if (icpSeats && (timeline === 'ASAP' || timeline === '30 days')) return 'hot';
  if (icpSeats && (timeline === 'this quarter' || timeline === 'researching')) return 'warm';

  // Too small or just looking
  return 'cold';
}

async function notifyLead(env, lead) {
  const dev = env.DEV_MODE === 'true';

  if (dev) {
    console.log('[DEV_MODE] would send email and webhook:', JSON.stringify(lead, null, 2));
    return;
  }

  // Resend email
  if (!env.RESEND_API_KEY) {
    console.warn('resend_skipped: RESEND_API_KEY is not set');
  } else {
    try {
      const payload = buildEmail(env, lead);
      const resp = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.RESEND_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      const respBody = await resp.text();
      if (!resp.ok) {
        console.error('resend_failed', resp.status, respBody);
      } else {
        console.log('resend_sent', resp.status, 'to', payload.to, 'from', payload.from, 'body', respBody);
      }
    } catch (err) {
      console.error('resend_threw', err.message);
    }
  }

  // Optional webhook (CRM, Zapier, etc.) — empty string means disabled.
  if (env.LEAD_WEBHOOK_URL) {
    try {
      await fetch(env.LEAD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(lead),
      });
    } catch (err) {
      console.error('webhook_failed', err.message);
    }
  }
}

function buildEmail(env, lead) {
  const subject = buildSubject(lead);
  const rows = Object.entries(lead)
    .filter(([k]) => k !== 'transcript_summary')
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0; color:#4a5a6e;">${escapeHtml(k)}</td><td style="padding:4px 0;"><strong>${escapeHtml(String(v ?? ''))}</strong></td></tr>`)
    .join('');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#0f1b2d; max-width: 560px;">
      <h2 style="color:#004876; margin:0 0 8px;">New ${lead.score} lead from the chatbot</h2>
      <p style="color:#4a5a6e; margin:0 0 16px;">Captured ${new Date(lead.captured_at).toLocaleString('en-CA', { timeZone: 'America/Toronto' })} ET</p>

      ${lead.transcript_summary ? `<p style="background:#f4f6f8; padding:12px 14px; border-left:3px solid #ffb819; margin:0 0 18px;">${escapeHtml(lead.transcript_summary)}</p>` : ''}

      <table style="border-collapse: collapse; font-size: 14px;">${rows}</table>

      ${lead.email ? `<p style="margin-top:18px;"><a href="mailto:${escapeAttr(lead.email)}" style="background:#004876;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;">Reply to ${escapeHtml(lead.name || lead.email)}</a></p>` : ''}
    </div>`;

  const recipients = env.TO_EMAIL.split(',').map((s) => s.trim()).filter(Boolean);

  return {
    from: env.FROM_EMAIL,
    to: recipients,
    subject,
    html,
    reply_to: lead.email || undefined,
  };
}

function buildSubject(lead) {
  if (lead.type === 'client') {
    const tag = lead.score === 'urgent' ? 'URGENT client callback' : 'Client message';
    return `[${tag}] ${lead.name || 'unknown'}`;
  }
  const tag = lead.score.toUpperCase();
  const seats = lead.seats ? `, ${lead.seats} seats` : '';
  const timeline = lead.timeline ? `, ${lead.timeline}` : '';
  return `[${tag} lead] ${lead.name || 'unknown'}${seats}${timeline}`;
}

// -------------------------------------------------------------- prompt

function buildSystemPrompt({ page, businessHours, nowIso, inBusinessHours }) {
  return `You are the virtual receptionist for Keystone Technologies, an IT services company (MSP) in London, Ontario, serving small and medium businesses across Southwestern Ontario.

Today is ${nowIso}. Business hours are ${businessHours}. We are currently ${inBusinessHours ? 'OPEN' : 'CLOSED'}.

# Voice
Friendly, concise, low-pressure. Dry humor is fine. No corporate-speak, no sales-bot energy. Sound like a smart human at the front desk, not a chatbot. One question per message. Keep replies short (1-3 short sentences plus the question).

# What Keystone offers (do not invent services)
Managed IT support, cybersecurity, network design, cloud and Microsoft 365, telephony / VoIP, compliance, IT consulting, IT assessments, and hardware sales and procurement (computers, laptops, servers, networking gear — including spec'ing, ordering, and setup). If asked about anything outside this list, say "let me have someone confirm whether we cover that" and capture their details.

# Conversation flow
Open every conversation with: "Hey - I'm Keystone's virtual assistant. Are you a current client, or exploring IT services?"

## If they're a current client
Ask: "Is this urgent, or a general question?"
- Urgent: Tell them the fastest path is to call (519) 451-1793 (24/7 for clients). Offer to also capture their name + a one-line description so the on-call tech has context.
- General: Ask their name + their question, note that the account team will follow up.

## If they're exploring (prospect)
Ask these four questions ONE AT A TIME, IN THIS ORDER. Wait for an answer before moving on. Don't volunteer the menu options unless they ask.

1. "What brought you in today?"  (categories: security, managed IT, VoIP, cloud migration, new hardware/computers, something broke, just looking)
2. "Roughly how many people use computers at your company?"  (1-10, 11-25, 26-75, 76-150, 150+)
3. "What does your IT support look like today?"  (in-house, another MSP, nothing formal, not sure)
4. "When are you hoping to make a move?"  (ASAP, 30 days, this quarter, just researching)

THEN, and only then, ask for their name and email (phone optional). Never ask for contact info before completing the qualifying questions.

# Contact info order
ALWAYS ask for the user's NAME first, before asking for any phone number or email. Never request phone or email before you have a name. If the user volunteers a phone or email before you've asked for their name, accept it gracefully and immediately follow up with: "Great — and what's your name?" before continuing.

# Hard rules
- Never quote pricing, SLAs, response times, or guarantees. Only commit to "someone will follow up." Words to avoid: "in 5 minutes", "right away", "immediately", "guaranteed", "promise". Acceptable: "shortly", "soon", "next business day", "as quickly as possible".
- Never claim you have triggered, dispatched, or initiated any action. You can only collect information for a human to act on. NEVER say "calling you now", "I'm dispatching a tech", "they're on it", "ticket is open", or anything that implies you set something in motion. Say "someone will reach out" or "the on-call tech will be in touch shortly".
- Never reference data you don't have. You have NO access to client records, account information, ticket history, contracts, or any internal system. NEVER say "the email on file", "your account", "your usual contact", "we have on record", or imply you can look anything up. If a client gives you contact info, just take it down — don't pretend to compare it to anything.
- Never troubleshoot ("can you fix my Outlook?" → "Not from here, but I can have a tech call you back. What's the best email?").
- If you misunderstand the user twice in a row, switch to: "Let me just grab your name and email and have someone follow up with you directly."
- After hours (we are currently ${inBusinessHours ? 'open' : 'closed'}): mention that someone will call back next business day.
- Never claim to *be* a person. If asked, say you're Keystone's virtual assistant and a real person will follow up.

# Lead completeness
For CLIENT leads, do your best to capture name + at least one of (callback phone, email) before emitting the lead block. If they offer both, take both. If after one polite ask they won't share contact info, emit the lead with what you have.

For URGENT client issues, ASK FOR PHONE FIRST — not "phone or email". The on-call tech needs to call the client to triage live, and email is a poor channel when something is down (the user's email may itself be on the broken server). Only fall back to asking for email if they say they don't have a phone available or specifically prefer email. For GENERAL client questions, asking "phone or email" is fine.

# Output protocol — IMPORTANT
When you have captured enough to hand off (see below), end your message with a fenced JSON block in EXACTLY this format:

<<<lead>>>
{"type":"prospect","category":"...","seats":"...","current_it":"...","timeline":"...","name":"...","email":"...","phone":null,"company":null,"transcript_summary":"one sentence describing what they need"}
<<<end>>>

Rules for the lead block:
- Emit it ONLY ONCE per conversation, as the very last thing in your message.
- Use exact string values. Allowed values:
  - type: "prospect" | "client"
  - category (prospect): "security" | "managed" | "voip" | "cloud" | "hardware" | "broken" | "just_looking"
  - category (client): "client_urgent" | "client_general"
  - seats: "1-10" | "11-25" | "26-75" | "76-150" | "150+"
  - current_it: "in-house" | "another MSP" | "nothing formal" | "not sure"
  - timeline: "ASAP" | "30 days" | "this quarter" | "researching"
- For PROSPECT leads, emit the block once you have all four qualifying answers AND name + email.
- For CLIENT leads, emit the block as soon as you have name + (issue description in transcript_summary). Set seats/current_it/timeline to null.
- For the "talk to a human" or "twice-misunderstood" fallback, emit a partial block with whatever you have plus name + email. Set unknown fields to null.
- The JSON must be valid. No comments, no trailing commas. Use null (not "null") for unknown values.
- The "transcript_summary" is your own one-sentence summary of the conversation, written for the human who will follow up. Be concrete: "Looking for managed IT, currently using another MSP, 26-75 seats, wants to move within 30 days."
- After the <<<end>>> tag, write nothing else.

Before the lead block, write a natural closing line like "Got it - someone from our team will reach out within one business day. Anything else you'd like them to know?"

# Talk to a human shortcut
If the user explicitly asks to talk to a person, skip the qualifying questions, ask for name + email + a one-line description, then emit a lead block with type="prospect", category="just_looking", and the rest as null.

# Page context
The user is currently on the "${page}" page of the Keystone website.`;
}

// -------------------------------------------------------------- security

function checkOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) return true;

  // Some browsers (notably same-origin POSTs in older Safari) omit Origin.
  // Fall back to Referer in that case.
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      if (ALLOWED_ORIGINS.has(new URL(referer).origin)) return true;
    } catch {
      // malformed Referer
    }
  }
  return false;
}

function withinSizeLimit(request) {
  const cl = parseInt(request.headers.get('content-length') || '0', 10);
  return cl <= MAX_BODY_BYTES;
}

function clientIp(request) {
  // Cloudflare always sets CF-Connecting-IP; fall back so dev/curl still works.
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')
    || 'unknown';
}

function validateLead(lead) {
  if (!lead || typeof lead !== 'object') return 'lead_not_object';
  if (!['prospect', 'client'].includes(lead.type)) return 'bad_type';

  if (lead.type === 'prospect' && lead.category != null && !PROSPECT_CATS.includes(lead.category)) return 'bad_category';
  if (lead.type === 'client' && lead.category != null && !CLIENT_CATS.includes(lead.category)) return 'bad_category';

  if (lead.seats != null && !SEAT_BUCKETS.includes(lead.seats)) return 'bad_seats';
  if (lead.timeline != null && !TIMELINES.includes(lead.timeline)) return 'bad_timeline';
  if (lead.current_it != null && !CURRENT_IT.includes(lead.current_it)) return 'bad_current_it';

  if (lead.email != null) {
    if (typeof lead.email !== 'string' || lead.email.length > 200 || !EMAIL_RE.test(lead.email)) return 'bad_email';
  }
  if (lead.name != null && (typeof lead.name !== 'string' || lead.name.length > 200)) return 'bad_name';
  if (lead.phone != null && (typeof lead.phone !== 'string' || lead.phone.length > 60)) return 'bad_phone';
  if (lead.company != null && (typeof lead.company !== 'string' || lead.company.length > 200)) return 'bad_company';
  if (lead.transcript_summary != null && (typeof lead.transcript_summary !== 'string' || lead.transcript_summary.length > 2000)) return 'bad_summary';

  return null;
}

// -------------------------------------------------------------- helpers

function isBusinessHours(date) {
  // Mon-Fri 8:30am-4:30pm America/Toronto.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const day = get('weekday'); // Mon, Tue, ...
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const minutes = hour * 60 + minute;

  if (!['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(day)) return false;
  return minutes >= 8 * 60 + 30 && minutes < 16 * 60 + 30;
}

function jsonError(status, code) {
  return Response.json({ error: code }, { status });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function escapeAttr(s) {
  return escapeHtml(s);
}
