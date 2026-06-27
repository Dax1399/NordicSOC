# Nordic SOC — Insights / Blog system (developer guide)

The Insights section is **pre-rendered static HTML** — same as the marketing pages
(self-contained, inline CSS, content baked into the file). This is best for SEO and for
AI answer-engine visibility, and the pages open with no server.

Blog posts are authored in **WordPress**. A build script pulls them over the WordPress
REST API and regenerates the static files. (Until WordPress is connected, the script uses
the local `blog-content/` source — the 15 launch articles.)

## Files

| Path | Purpose |
|------|---------|
| `insights.html` | Blog index (root) — card grid + category filter, all cards baked in. Blog/ItemList/Breadcrumb JSON-LD. |
| `insights/<slug>.html` | One static page per post — content + BlogPosting/FAQPage/Breadcrumb JSON-LD + canonical/OG baked in. |
| `tools/build-from-wp.js` | Regenerates `insights.html` + `insights/*.html` from WordPress (or local source). |
| `assets/blog.css` | CSS **source** the build inlines into every page (not linked at runtime). |
| `blog-content/<slug>.html` + `.json` | Local source / WordPress import for the 15 launch articles. |

## Build / regenerate

```bash
# From the site root:

# 1) Local source (the 15 launch articles in blog-content/)
node tools/build-from-wp.js

# 2) From WordPress once it is live
NSOC_WP_API=https://blog.nordicsoc.com/wp-json/wp/v2 node tools/build-from-wp.js

# optional: override the canonical domain (defaults to https://nordicsoc.com)
NSOC_SITE_URL=https://nordicsoc.com NSOC_WP_API=... node tools/build-from-wp.js
```

Run it whenever posts are added/edited in WordPress (e.g. as a deploy step, a cron job, or
triggered by a WordPress "post published" webhook). It overwrites `insights.html` and the
files in `insights/`.

### WordPress requirements
- `_embed` is used, so featured image, author and category come back in one call.
- For FAQ schema, add an **ACF repeater** named `faq` (sub-fields `q`, `a`) to posts and
  expose ACF to the REST API. The builder reads `acf.faq[]`. The local JSON files already
  contain a `faq` array in this shape.
- SEO meta: the builder uses Yoast's `yoast_head_json.title` / `.description` if present,
  otherwise the title + excerpt.

### Field mapping (WP REST → page)
`title.rendered`, `content.rendered`, `excerpt.rendered`, `slug`, `date`, `modified`,
`_embedded['wp:featuredmedia'][0].source_url` (+ `alt_text`),
`_embedded.author[0].name`, `_embedded['wp:term'][0][0].name` (category).

## Importing the 15 launch articles into WordPress
Each article is two files in `blog-content/`:
- `<slug>.html` — the post **body** (clean HTML; paste into the WP editor). No `<h1>`
  (WP renders the title), no FAQ section (FAQ lives in the `faq` field for schema).
  Internal links are root-relative (`/...`); the builder rewrites them for the output path.
- `<slug>.json` — title, slug, category, tags, SEO meta (`meta_title`, `meta_description`,
  `focus_keyword`), excerpt, date, `faq[]`.

## Content plan (launch set — target keywords)

| # | Slug | Focus keyword | Category |
|---|------|---------------|----------|
| 1 | what-is-an-ai-soc | AI SOC | AI SOC |
| 2 | ai-soc-vs-traditional-soc | AI SOC vs traditional SOC | AI SOC |
| 3 | siem-less-soc | SIEM-less SOC | AI SOC |
| 4 | agentic-soc-explained | agentic SOC | AI SOC |
| 5 | soc-as-a-service-nordics | SOC as a service Nordics | Nordics |
| 6 | dora-compliance-soc | DORA compliance SOC | Compliance |
| 7 | nis2-soc-checklist | NIS2 SOC requirements | Compliance |
| 8 | eu-data-sovereignty-soc | EU data sovereignty | Compliance |
| 9 | mdr-explained | what is MDR | MDR |
| 10 | ai-alert-triage-alert-fatigue | alert fatigue | AI SOC |
| 11 | 24-7-soc-coverage-without-night-shift | 24/7 SOC coverage | Guides |
| 12 | mitre-attack-automated-investigation | MITRE ATT&CK SOC | Guides |
| 13 | ai-soc-manufacturing-ot-nordics | OT security Nordics | Nordics |
| 14 | autonomous-containment-safe | automated incident response | AI SOC |
| 15 | choosing-ai-soc-provider-europe | AI SOC provider Europe | Guides |

## SEO / AEO checklist
- Content is in the raw HTML (pre-rendered) — ideal for Google and AI answer engines.
- Every article is answer-first, with a Key Takeaways box, a comparison table and a
  5-question FAQ (FAQPage schema) — the formats AI engines cite most.
- Still to add for maximum effect:
  - `Organization` + `WebSite` JSON-LD on the **homepage** (entity recognition for "Nordic SOC").
  - An **XML sitemap** listing `/insights.html` and every `/insights/<slug>.html`, plus a
    `robots.txt` — submit to Google Search Console and Bing Webmaster Tools.
  - Optional pretty URLs via `.htaccess` (`/insights/<slug>` → `/insights/<slug>.html`).
