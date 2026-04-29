# Keystone WordPress theme — dev.kct.ca dry run

End-to-end checklist for getting the WP site live at **dev.kct.ca** on
HostGator. Plan on ~30 minutes if HostGator's WP installer is fast.

---

## 1. Create the dev.kct.ca subdomain on HostGator

1. **cPanel → Domains → Subdomains** (or "Domains" depending on your cPanel
   version).
2. Add subdomain:
   - **Subdomain:** `dev`
   - **Domain:** `kct.ca`
   - **Document Root:** auto-fills to `public_html/dev.kct.ca` — leave it.
3. Save. HostGator provisions DNS automatically since `kct.ca` is on their
   nameservers.

> Quick check: visit `https://dev.kct.ca` — you should see a blank or
> default cPanel page within a minute or two.

---

## 2. Install WordPress on dev.kct.ca

1. **cPanel → WordPress / Softaculous Apps Installer / Installatron** —
   whichever is on your panel.
2. Click "Install" with these values:
   - **Choose protocol:** `https://`
   - **Choose domain:** `dev.kct.ca`
   - **In directory:** *(leave empty — install at the root of the subdomain)*
   - **Site Name:** `Keystone Technologies (dev)`
   - **Admin Username:** something other than `admin`
   - **Admin Password:** strong; save it
   - **Admin Email:** your real address
   - **Database:** let the installer auto-create
3. Install. Login at `https://dev.kct.ca/wp-admin/`.

> **Confirm PHP 8.3:** cPanel → MultiPHP Manager → ensure `dev.kct.ca`
> is on PHP 8.3. The theme requires 8.1+ — 8.3 gives the best performance.

---

## 3. Install the Keystone theme zip

1. Get the zip:
   - Go to https://github.com/qindarka/keystone-website/releases
   - Find **"WordPress theme — latest build"**
   - Download `keystone.zip`
2. WP Admin → **Appearance → Themes → Add New → Upload Theme**.
3. Choose `keystone.zip`, click "Install Now", then "Activate".

After activation you'll see a blue admin notice at the top:
> *"Keystone theme: Import demo content (all pages, 8 services, ~50
> knowledge articles) so you can see the site populated."*

**Don't click it yet.** Step 4 first.

---

## 4. Install required plugins

The theme works without these, but the dry run needs them:

- **WordPress Importer** — used for the demo content load
  - Plugins → Add New → search "WordPress Importer" → Install → Activate
- **Fluent Forms** *(free tier — for the contact form fallback)*
  - Plugins → Add New → search "Fluent Forms" → Install → Activate

---

## 5. Import the demo content

Now click **"Import demo content"** in the blue admin notice (or visit
WP Admin and look for it). This loads:

- 1 Home page (uses Keystone block patterns)
- 8 standard pages (About, Contact, Services overview, Careers,
  Accessibility, Privacy, Terms, Thanks)
- 8 Services (custom post type)
- ~50 Knowledge articles (posts, "Knowledge" category)

Takes ~10–30 seconds. When it's done you'll be redirected to **Pages**.

---

## 6. Set permalinks + front page

1. **Settings → Permalinks** → choose **"Post name"** → Save Changes.
   *(This activates the `/knowledge/<slug>/` and `/services/<slug>/`
   rewrite rules.)*
2. **Settings → Reading**:
   - "Your homepage displays" → **A static page**
   - **Homepage** → `Home`
   - **Posts page** → leave blank (we use a category archive at `/knowledge/`)
3. Save.

Visit `https://dev.kct.ca` — you should see the full homepage with hero,
services grid, why-keystone, industries, process, testimonials and CTA.

---

## 7. Build the menu

WP doesn't auto-build a nav menu from imports. Do this once:

1. **Appearance → Editor → Navigation**.
2. Add links: Home, Services, About, Knowledge, Careers, Contact (last
   one styled as the "Get Support" CTA).
3. Save.

*(The header part also has a hardcoded fallback nav, so even if the
WP nav block is empty, links still appear. The menu in step 7 only
matters if you switch to a fully editable nav block.)*

---

## 8. Wire the contact form (Fluent Forms)

1. **Fluent Forms → New Form → Contact Form**.
2. Build whatever fields you want (Name, Email, Phone, Message).
3. **Settings → Confirmations** → redirect to `/thanks/` after submit.
4. **Settings → Email Notifications** → set the To address to
   `jwoods@keystonetech.ca, accounts@keystonetech.ca` (matches the
   chatbot lead destination).
5. Copy the form's shortcode (looks like `[fluentform id="1"]`).
6. **Pages → Contact → Edit** → paste the shortcode where the legacy
   placeholder form was, save.

---

## 9. Confirm the chatbot still works

The chatbot widget loads automatically on the `/contact` page and points
at the existing Cloudflare Worker. To confirm:

1. Visit `https://dev.kct.ca/contact/`.
2. Click the round chat bubble in the bottom right.
3. Ask a question. You should get a real reply from Claude Haiku.

If the bubble doesn't open, browser console errors usually mean the
Worker rejected the origin. The Worker now allows `https://dev.kct.ca`
(see `src/worker.js` `ALLOWED_ORIGINS`) — confirm the Worker has been
redeployed with that change.

---

## 10. Sanity sweep

Click through:

- `/` — homepage with all 7 sections
- `/services/` — list of 8 services
- `/services/managed/` — single service page
- `/knowledge/` — list of articles
- `/knowledge/<any-slug>/` — single article
- `/about/`, `/careers/`, `/privacy/`, `/terms/`, `/accessibility/`,
  `/thanks/` — all render
- `/contact/` — form + chatbot

If anything renders blank, it's almost always permalinks (re-save them
under Settings → Permalinks).

---

## When you're ready to go to production

The dev.kct.ca install is throwaway by design. To launch on
keystonetech.ca:

1. Repeat steps 1–8 on the production install (or use a migration
   plugin like All-in-One WP Migration to clone dev → prod).
2. Update the Worker's `ALLOWED_ORIGINS` if production uses a domain
   we haven't already allowed.
3. Cut DNS over.

The Cloudflare Worker stays unchanged — it's our chatbot backend
forever, regardless of where the front-end lives.
