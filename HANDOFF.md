# Session handoff — 2026-04-27

Quick brief for picking this back up tomorrow (possibly on the Ubuntu server).

## What this repo is

Static marketing site for Keystone Technologies (London, ON MSP), deployed as a
Cloudflare Worker with Static Assets. The Worker also hosts an AI chatbot that
qualifies leads on `/contact`. Everything is vanilla HTML/CSS/JS — no framework,
no build step — for eventual portability to WordPress.

- Live (Cloudflare workers.dev): https://keystone-website.keystonetech.workers.dev
- Eventual prod domain: https://keystonetech.ca (DNS not yet cut over)
- Repo remote: https://github.com/qindarka/keystone-website
- Deploy branches kept in sync: `main` and `initial-site` (Cloudflare watches both)
- Stable rollback tag: `stable-2026-04-27` (commit `f7ce2c0`)

## What's deployed right now

Latest commit on both branches: `5909199` — chatbot guardrails tightened
(no fabricated actions, no fake account lookups, lead-completeness rule).

Cloudflare auto-deploys on every push via GitHub integration.

## The chatbot in 60 seconds

- Widget: `assets/js/chatbot.js` — vanilla IIFE, all CSS prefixed `kst-`,
  loaded only on `contact.html` via one `<script>` tag.
- Worker: `src/worker.js` — routes `/api/chat` and `/api/lead`, falls through
  to `env.ASSETS.fetch()` for everything else.
- Model: `claude-haiku-4-5-20251001` via Anthropic API.
- Email: Resend, sending from `noreply@updates.kct.ca` to `sales@keystonetech.ca`.
- Storage: Cloudflare KV namespace `CHAT_KV` (id in `wrangler.jsonc`).
  - `transcript:{sessionId}` — full conversation, 30-day TTL
  - `lead:{ts}-{sessionId}` — captured lead, no TTL
- Rate limits (per IP, via Cloudflare ratelimit binding):
  - `/api/chat`: 15 req/min
  - `/api/lead`: 3 req/min
- Origin-pinned to: `keystone-website.keystonetech.workers.dev`,
  `keystonetech.ca`, `www.keystonetech.ca`, `localhost:8787`.

## Secrets (production — set on Cloudflare side, NOT in git)

Already set via `npx wrangler secret put`:

- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`

Verify with `npx wrangler secret list` (shows names only, never values).

## Local development

**IMPORTANT**: always start with `--persist-to` outside the project dir,
otherwise wrangler hits an infinite reload loop (the KV simulator writes
to `.wrangler/` and trips the asset watcher):

```
npx wrangler dev --persist-to ../.wrangler-state
```

Open `http://localhost:8787/contact`, click the bubble.

For local secrets, copy `.dev.vars.example` to `.dev.vars` and fill in.
`.dev.vars` is gitignored. Keep `DEV_MODE=true` locally so testing won't
actually send emails — the worker logs `[DEV_MODE] would send email...`
to the wrangler terminal instead.

## Open threads

1. **M365 deliverability** — Resend confirms emails are sending
   successfully (visible in Resend dashboard) but they're not landing
   in `sales@keystonetech.ca`. Most likely cause: M365 quarantine /
   Junk for a brand-new sending domain (`updates.kct.ca` has no
   reputation history yet).

   Diagnostic path:
   - Check Junk folder
   - Check `https://security.microsoft.com/quarantine` filtered by
     sender = `noreply@updates.kct.ca`
   - Run Exchange Mail flow → Message trace for definitive answer
   - Lasting fix: add a Mail flow rule that bypasses spam filtering
     for `updates.kct.ca` mail with `dkim=pass` AND `spf=pass` headers

2. **Old WordPress service slugs** — `_redirects` has best-guess slugs
   (`/services/network-security`, etc.). User should verify against
   Google Search Console's actual indexed URLs and let me know any
   corrections.

3. **DNS cutover** — when `keystonetech.ca` DNS eventually points at
   Cloudflare, no code changes needed; everything (chatbot, redirects,
   assets) rides along automatically.

4. **Existing contact form** on `/contact` is a leftover Netlify-style
   form that isn't wired to anything. User's call: leave as fallback
   (current decision) or wire it up later.

5. **Chatbot scope** — currently only on `/contact`. Expanding to home,
   services, knowledge etc. just means adding the same `<script>` tag
   with the appropriate `data-page` attribute. System prompt has page
   context but per-page greetings are stubbed for now.

## Helpful commands

```bash
# Local dev
npx wrangler dev --persist-to ../.wrangler-state

# Watch live worker logs in real time
npx wrangler tail

# Set/rotate a production secret
npx wrangler secret put ANTHROPIC_API_KEY

# Check what's in a KV key (for debugging leads/transcripts)
npx wrangler kv key get --binding=CHAT_KV "lead:..."

# Roll back if something's broken
git revert <bad-sha> && git push
# or to nuke everything since the stable tag:
git reset --hard stable-2026-04-27 && git push --force origin main
```

## Recent work (latest first)

- `5909199` Tighten chatbot guardrails: no fabricated actions or fake account lookups
- `7cdf9a8` Log every Resend outcome for chatbot lead notifications
- `0a5079c` Always ask for name before phone/email in chatbot
- `f0f37b7` Harden chatbot Worker against abuse (rate limits, origin pin, schema validation)
- `128ad4b` Restore textarea focus after each chatbot reply
- `a8bcb2f` Add AI chatbot widget for /contact
- `f7ce2c0` Collapse 100 article redirects into 12 placeholder rules (fixed Cloudflare 100-rule limit)
- `51f49a4` Update tenure copy to 30+ years serving local SMBs
- `163b879` SEO preservation: full redirect map, sitemap.xml, robots.txt

## Tone / collaboration notes for next session

- User is jlwoods@kct.ca, owner of Keystone Technologies (MSP). Knows the
  M365 / IT side cold; treats the website work as something to ship and
  iterate, not over-engineer.
- Auto mode has been on — execute, don't over-explain. Push fixes
  promptly. Confirm at the end with what landed where.
- Two branches always kept in sync (`main` and `initial-site`). Push to
  both on every commit:
  `git push origin main && git push origin main:initial-site`
- User runs Windows here but may be on Ubuntu next session. Bash works
  on both; `Remove-Item` etc. is Windows-only.
