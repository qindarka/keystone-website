# Keystone WordPress theme

Block theme (FSE) port of the Keystone Technologies marketing site, designed
to drop into any standard WordPress 6.4+ install on PHP 8.1+. Built for the
HostGator dev.kct.ca dry run, with `keystonetech.ca` as the eventual prod
target.

## What's here

```
wordpress-theme/
├── keystone/                  ← becomes keystone.zip on every push
│   ├── style.css              ← theme metadata
│   ├── theme.json             ← brand tokens (colors, fonts, spacing)
│   ├── functions.php          ← theme bootstrap
│   ├── templates/             ← FSE templates (front-page, page, single, archive, single-service, 404)
│   ├── parts/                 ← header + footer
│   ├── patterns/              ← hero, services-grid, why-keystone, industries, process, testimonials, cta-banner
│   ├── inc/
│   │   ├── post-types.php     ← `service` CPT + /knowledge/ rewrite
│   │   ├── chatbot.php        ← embeds widget on /contact, points at Worker
│   │   ├── patterns.php       ← registers the "keystone" pattern category
│   │   ├── demo-import.php    ← one-click WXR importer (admin notice)
│   │   └── demo-content.xml   ← bundled demo content (1 home + 8 pages + 8 services + 50 articles)
│   └── assets/                ← copied from the static site (CSS, JS, logo)
├── build/
│   └── generate-wxr.js        ← regenerates inc/demo-content.xml from the static HTML
├── HOSTGATOR-SETUP.md         ← end-to-end deploy steps for dev.kct.ca
└── README.md                  ← you are here
```

## How to get the zip

GitHub Actions builds `keystone.zip` automatically on every push to the
`wordpress-theme` branch. Grab it from
https://github.com/qindarka/keystone-website/releases under the
"WordPress theme — latest build" release.

Manual build (if needed):

```sh
cd wordpress-theme && zip -r ../keystone.zip keystone -x "*.DS_Store"
```

## Regenerating demo content

If you change the static site (the source of truth for the WXR), regenerate:

```sh
node wordpress-theme/build/generate-wxr.js
```

Re-zip and re-upload to test.

## Editability — what's intentionally locked vs. open

**Open in the editor (Pages → Edit Page → Gutenberg):**
- Every page's body content
- Every word, image, paragraph, heading, button, link in any page
- Block patterns (Hero, Services Grid, etc.) — edit any pattern via
  Site Editor → Patterns and your edit propagates everywhere it's used
- Service post details
- Article content + featured images
- Categories and tags

**Locked by design (theme files):**
- Header (utility bar + nav bar) — editable via Site Editor → Patterns →
  Template Parts → Header, but not per-page
- Footer — same: editable site-wide via Site Editor → Patterns →
  Template Parts → Footer
- Brand tokens (navy, gold, fonts) — change via theme.json, not the
  editor, to stay consistent across the site

This split keeps the design coherent (no rogue Comic Sans paragraphs)
while giving non-developers full control over copy and content.

## Chatbot

The widget continues to live in the Cloudflare Worker
(`src/worker.js` in this repo). The theme just enqueues `chatbot.js` on
`/contact` and points it at the Worker URL. To switch the API base
(e.g. moving the Worker to a custom domain), define
`KEYSTONE_CHATBOT_API_BASE` in `wp-config.php`:

```php
define( 'KEYSTONE_CHATBOT_API_BASE', 'https://api.keystonetech.ca' );
```

…or filter `keystone_chatbot_api_base` from a child theme / mu-plugin.
