# Keystone Technologies — Website

Static marketing site for [keystonetech.ca](https://keystonetech.ca/), built as plain HTML / CSS / JavaScript so it can be deployed today on Cloudflare Pages and ported to a WordPress theme later with minimal rework.

## Structure

```
.
├── index.html              # Home
├── services.html           # Services overview
├── about.html              # About + careers (#careers anchor)
├── contact.html            # Contact form
├── client-login.html       # Client portal sign-in
├── employee-login.html     # Internal staff sign-in
├── thanks.html             # Form success page
├── 404.html                # Not found
├── assets/
│   ├── css/styles.css
│   ├── js/main.js
│   └── images/keystone.svg # Brand mark (sourced from existing site)
├── _headers                # Cloudflare Pages security + cache headers
├── _redirects              # Cloudflare Pages pretty URLs / 404 fallback
└── README.md
```

## Brand

- **Primary navy:** `#004876`
- **Accent gold:** `#ffb819`
- Fonts: Inter (body) + Manrope (headings) via Google Fonts

## Local preview

No build step required. Serve the directory with any static server, e.g.:

```bash
npx serve .
# or
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## Deploying to Cloudflare Pages

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick this repository.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave blank)*
   - **Build output directory:** `/`
4. Deploy.

Cloudflare Pages will automatically pick up `_headers` and `_redirects`.

### Custom domain

Once deployed, attach `keystonetech.ca` (and `www.keystonetech.ca`) under **Custom domains** on the Pages project.

## Migrating to WordPress later

The markup is intentionally semantic and flat (no JS framework, no build pipeline). Each page maps cleanly to a WordPress template:

- `index.html` → `front-page.php`
- `services.html` → `page-services.php`
- `about.html` → `page-about.php`
- `contact.html` → `page-contact.php`
- `assets/css/styles.css` → `style.css` (theme stylesheet)
- `assets/js/main.js` → enqueue via `wp_enqueue_script`
- Header / footer regions → `header.php` / `footer.php`

The contact form on `contact.html` uses Netlify-style form attributes; for WordPress, swap to a plugin (Gravity Forms, WPForms, Fluent Forms) or hook the `<form>` to `admin-post.php`.

## Forms

`contact.html` posts to `/thanks.html` with `data-netlify="true"` attributes. On Cloudflare Pages, the simplest path is to wire the form to:

- A Cloudflare Worker that emails / forwards the submission, or
- A third-party service like Formspree / Basin / Web3Forms

(These attributes are harmless if no form handler is configured — the form just won't submit.)
