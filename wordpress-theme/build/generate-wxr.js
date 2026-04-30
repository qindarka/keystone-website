#!/usr/bin/env node
/**
 * Generate demo-content.xml (WXR) from the existing static HTML.
 *
 * Walks index.html, /services/*.html and /knowledge/*.html, extracts the
 * <main> content from each, and writes a single WXR file to
 * keystone/inc/demo-content.xml. The file imports cleanly through
 * Tools → Import → WordPress in any WP install.
 *
 * Special handling:
 *   - Home page uses block-pattern references (so each section is editable
 *     in the Site Editor as a pattern). All other pages embed their main
 *     content as a Custom HTML block — visual fidelity stays 1:1 with the
 *     static site, and editors can still tweak text via the editor.
 *   - Knowledge articles become posts in category "Knowledge", living at
 *     /knowledge/<slug>/ via the rewrite in inc/post-types.php.
 *   - Services become a custom post type, living at /services/<slug>/.
 */

const fs   = require('fs');
const path = require('path');

const REPO  = path.resolve(__dirname, '../..');
const OUT   = path.resolve(__dirname, '../keystone/inc/demo-content.xml');

const SITE_TITLE = 'Keystone Technologies';
const SITE_URL   = 'https://keystonetech.ca';
const AUTHOR     = 'admin';
const NOW        = new Date().toISOString().replace('T', ' ').replace(/\..+$/, '');

let nextId = 1000;
const items = [];

// ---- helpers ----------------------------------------------------------

function read(rel) {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s*[—|–-]\s*Keystone Technologies.*$/i, '').trim() : '';
}

function extractDescription(html) {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return m ? m[1].trim() : '';
}

function extractMain(html) {
  // Prefer <main>...</main>. Fall back to <body>...</body> minus
  // header/footer for pages without a <main> wrapper (e.g. thanks.html).
  let inner = '';
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (m) {
    inner = m[1];
  } else {
    const b = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (!b) return '';
    inner = b[1]
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');
  }

  // Convert relative /assets/... paths to theme paths so images keep
  // resolving once they're served from /wp-content/themes/keystone/assets/.
  inner = inner.replace(/(["'])\/assets\//g, '$1/wp-content/themes/keystone/assets/');

  return inner.trim();
}

function cdata(text) {
  // Escape any nested ]]> sequences (rare but legal).
  return '<![CDATA[' + String(text).replace(/]]>/g, ']]]]><![CDATA[>') + ']]>';
}

function customHtmlBlock(html) {
  // Wrap raw HTML as a single Custom HTML block — preserves visual fidelity
  // 1:1 with the static site while still letting editors flip to "Edit as
  // HTML" or replace whole sections with native blocks if they want.
  return `<!-- wp:html -->\n${html}\n<!-- /wp:html -->`;
}

function makeItem({ id, title, slug, content, postType = 'page', excerpt = '', categories = [], menuOrder = 0, parent = 0 }) {
  const linkPath = postType === 'page'
    ? (slug === 'home' ? '/' : `/${slug}/`)
    : postType === 'service'
      ? `/services/${slug}/`
      : `/knowledge/${slug}/`;

  const catTags = categories.map(c =>
    `<category domain="category" nicename="${c.slug}">${cdata(c.name)}</category>`
  ).join('\n      ');

  return `
  <item>
    <title>${cdata(title)}</title>
    <link>${SITE_URL}${linkPath}</link>
    <pubDate>${new Date().toUTCString()}</pubDate>
    <dc:creator>${cdata(AUTHOR)}</dc:creator>
    <guid isPermaLink="false">${SITE_URL}/?p=${id}</guid>
    <description></description>
    <content:encoded>${cdata(content)}</content:encoded>
    <excerpt:encoded>${cdata(excerpt)}</excerpt:encoded>
    <wp:post_id>${id}</wp:post_id>
    <wp:post_date>${cdata(NOW)}</wp:post_date>
    <wp:post_date_gmt>${cdata(NOW)}</wp:post_date_gmt>
    <wp:comment_status>${cdata('closed')}</wp:comment_status>
    <wp:ping_status>${cdata('closed')}</wp:ping_status>
    <wp:post_name>${cdata(slug)}</wp:post_name>
    <wp:status>${cdata('publish')}</wp:status>
    <wp:post_parent>${parent}</wp:post_parent>
    <wp:menu_order>${menuOrder}</wp:menu_order>
    <wp:post_type>${cdata(postType)}</wp:post_type>
    <wp:post_password></wp:post_password>
    <wp:is_sticky>0</wp:is_sticky>
    ${catTags}
  </item>`;
}

// ---- 1) Home page (uses block patterns) -------------------------------

const homeContent = [
  '<!-- wp:pattern {"slug":"keystone/hero"} /-->',
  '<!-- wp:pattern {"slug":"keystone/services-grid"} /-->',
  '<!-- wp:pattern {"slug":"keystone/why-keystone"} /-->',
  '<!-- wp:pattern {"slug":"keystone/industries"} /-->',
  '<!-- wp:pattern {"slug":"keystone/process"} /-->',
  '<!-- wp:pattern {"slug":"keystone/testimonials"} /-->',
  '<!-- wp:pattern {"slug":"keystone/cta-banner"} /-->',
].join('\n\n');

items.push(makeItem({
  id: nextId++,
  title: 'Home',
  slug: 'home',
  content: homeContent,
  postType: 'page',
  excerpt: extractDescription(read('index.html')),
}));

// ---- 2) Top-level pages (about, contact, services, careers, etc.) ----

const TOP_PAGES = [
  { file: 'about.html',         slug: 'about',         title: 'About Us' },
  { file: 'contact.html',       slug: 'contact',       title: 'Contact' },
  { file: 'services.html',      slug: 'services',      title: 'Services' },
  { file: 'careers.html',       slug: 'careers',       title: 'Careers' },
  { file: 'accessibility.html', slug: 'accessibility', title: 'Accessibility' },
  { file: 'privacy.html',       slug: 'privacy',       title: 'Privacy Policy' },
  { file: 'terms.html',         slug: 'terms',         title: 'Terms of Use' },
  { file: 'thanks.html',        slug: 'thanks',        title: 'Thanks' },
];

for (const p of TOP_PAGES) {
  const html = read(p.file);
  const main = extractMain(html);
  if (!main) {
    console.warn(`! could not extract <main> from ${p.file}`);
    continue;
  }
  items.push(makeItem({
    id: nextId++,
    title: p.title,
    slug: p.slug,
    content: customHtmlBlock(main),
    postType: 'page',
    excerpt: extractDescription(html),
  }));
}

// ---- 2b) Knowledge index page (hero + shortcode auto-grid) -----------

const knowledgeContent = [
  '<!-- wp:html -->',
  '<section class="page-header">',
  '  <div class="container">',
  '    <div class="crumb"><a href="/">Home</a> &rsaquo; Knowledge</div>',
  '    <h1>Articles &amp; insights</h1>',
  '    <p>Practical guidance on managed IT, cybersecurity, cloud, compliance and the technology that runs your business — from the Keystone Technologies team.</p>',
  '  </div>',
  '</section>',
  '',
  '<section class="section">',
  '  <div class="container">',
  '<!-- /wp:html -->',
  '',
  '<!-- wp:shortcode -->',
  '[keystone_knowledge_grid]',
  '<!-- /wp:shortcode -->',
  '',
  '<!-- wp:html -->',
  '  </div>',
  '</section>',
  '<!-- /wp:html -->',
].join('\n');

items.push(makeItem({
  id: nextId++,
  title: 'Knowledge',
  slug: 'knowledge',
  content: knowledgeContent,
  postType: 'page',
  excerpt: 'Articles, insights and how-tos from the Keystone Technologies team.',
}));

// ---- 3) Services (custom post type) -----------------------------------

const SERVICE_TITLES = {
  managed:       'Managed IT Support',
  cybersecurity: 'Cybersecurity',
  network:       'Network & Infrastructure',
  cloud:         'Cloud Solutions',
  voip:          'Telephony & VoIP',
  compliance:    'Compliance & Audit',
  consulting:    'IT Consulting & vCIO',
  assessments:   'IT Assessments',
};

const serviceFiles = fs.readdirSync(path.join(REPO, 'services')).filter(f => f.endsWith('.html'));
let svcOrder = 0;
for (const f of serviceFiles) {
  const slug = f.replace(/\.html$/, '');
  const html = read(`services/${f}`);
  const main = extractMain(html);
  const title = SERVICE_TITLES[slug] || extractTitle(html) || slug;
  items.push(makeItem({
    id: nextId++,
    title,
    slug,
    content: customHtmlBlock(main),
    postType: 'service',
    excerpt: extractDescription(html),
    menuOrder: svcOrder++,
  }));
}

// ---- 4) Knowledge articles (posts, "knowledge" category) --------------

// Extract the article-slug → original-publication-date map from
// knowledge.html. Each card looks like:
//   <a class="kn-card ..." href="/knowledge/<slug>">
//     ...
//     <span class="kn-card-date">December 9, 2021</span>
const knowledgeIndex = read('knowledge.html');
const articleDates = {};
{
  const cardRe = /<a[^>]+class="kn-card[^"]*"[^>]+href="\/knowledge\/([^"#?]+)"[\s\S]*?<span class="kn-card-date">([^<]+)<\/span>/g;
  let m;
  while ((m = cardRe.exec(knowledgeIndex)) !== null) {
    const slug = m[1].replace(/\/$/, '');
    const dateText = m[2].trim();
    const parsed = new Date(dateText);
    if (!Number.isNaN(parsed.getTime())) {
      // Format: YYYY-MM-DD HH:MM:SS for WP/MySQL.
      articleDates[slug] = parsed.toISOString().replace('T', ' ').replace(/\..+$/, '');
    }
  }
}
console.log(`  parsed dates for ${Object.keys(articleDates).length} articles`);

// Persist the map as JSON so a runtime admin action can fix up dates
// for posts that were already imported with NOW.
fs.writeFileSync(
  path.resolve(__dirname, '../keystone/inc/article-dates.json'),
  JSON.stringify(articleDates, null, 2)
);

const articleFiles = fs.readdirSync(path.join(REPO, 'knowledge')).filter(f => f.endsWith('.html'));
for (const f of articleFiles) {
  const slug = f.replace(/\.html$/, '');
  const html = read(`knowledge/${f}`);
  const main = extractMain(html);
  const title = extractTitle(html) || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  let item = makeItem({
    id: nextId++,
    title,
    slug,
    content: customHtmlBlock(main),
    postType: 'post',
    excerpt: extractDescription(html),
    categories: [ { slug: 'knowledge', name: 'Knowledge' } ],
  });
  // Override the import-time post_date with the original publication
  // date when we have one parsed from knowledge.html.
  if (articleDates[slug]) {
    const d = articleDates[slug];
    item = item.replace(
      /<wp:post_date>[\s\S]*?<\/wp:post_date>\s*<wp:post_date_gmt>[\s\S]*?<\/wp:post_date_gmt>/,
      `<wp:post_date>${cdata(d)}</wp:post_date>\n    <wp:post_date_gmt>${cdata(d)}</wp:post_date_gmt>`
    );
  }
  items.push(item);
}

// ---- assemble WXR -----------------------------------------------------

const wxr = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title>${SITE_TITLE}</title>
  <link>${SITE_URL}</link>
  <description>Keystone Technologies marketing site export</description>
  <pubDate>${new Date().toUTCString()}</pubDate>
  <language>en-CA</language>
  <wp:wxr_version>1.2</wp:wxr_version>
  <wp:base_site_url>${SITE_URL}</wp:base_site_url>
  <wp:base_blog_url>${SITE_URL}</wp:base_blog_url>

  <wp:author>
    <wp:author_id>1</wp:author_id>
    <wp:author_login>${cdata(AUTHOR)}</wp:author_login>
    <wp:author_email>${cdata('info@keystonetech.ca')}</wp:author_email>
    <wp:author_display_name>${cdata('Keystone Technologies')}</wp:author_display_name>
    <wp:author_first_name>${cdata('Keystone')}</wp:author_first_name>
    <wp:author_last_name>${cdata('')}</wp:author_last_name>
  </wp:author>

  <wp:category>
    <wp:term_id>10</wp:term_id>
    <wp:category_nicename>${cdata('knowledge')}</wp:category_nicename>
    <wp:category_parent>${cdata('')}</wp:category_parent>
    <wp:cat_name>${cdata('Knowledge')}</wp:cat_name>
  </wp:category>

  ${items.join('\n')}

</channel>
</rss>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, wxr);

console.log(`Wrote ${items.length} items → ${OUT}`);
