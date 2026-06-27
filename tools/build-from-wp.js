#!/usr/bin/env node
/**
 * Nordic SOC — static blog builder.
 *
 * Pre-renders the Insights section into plain static HTML (same as the
 * marketing pages — self-contained, inline CSS, content baked in), so it
 * ranks well and opens without a server.
 *
 * SOURCE of posts (in priority order):
 *   1) WordPress REST API, if NSOC_WP_API is set
 *        NSOC_WP_API=https://blog.nordicsoc.com/wp-json/wp/v2 node tools/build-from-wp.js
 *   2) Local files in ../blog-content/ (*.json metadata + *.html body)
 *
 * OUTPUT:
 *   ../insights.html              (index, cards baked in)
 *   ../insights/<slug>.html       (one static page per post)
 *
 * Re-run this whenever blog posts change to regenerate the static files.
 */
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const OUT_POSTS = path.join(SITE, 'insights');
const CSS = fs.readFileSync(path.join(SITE, 'assets', 'blog.css'), 'utf8');
const SITE_URL = process.env.NSOC_SITE_URL || 'https://nordicsoc.com';
const WP = process.env.NSOC_WP_API || '';

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const fmtDate = iso => { const d = new Date(iso); if (isNaN(d)) return ''; return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
const readMins = html => Math.max(1, Math.ceil(stripTags(html).split(' ').length / 200)) + ' min read';
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---- load posts ----
async function loadWP() {
  const res = await fetch(`${WP.replace(/\/$/, '')}/posts?_embed&per_page=100`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('WP HTTP ' + res.status);
  const data = await res.json();
  return data.map(p => ({
    title: p.title.rendered, slug: p.slug,
    meta_title: (p.yoast_head_json && p.yoast_head_json.title) || p.title.rendered,
    meta_description: (p.yoast_head_json && p.yoast_head_json.description) || stripTags(p.excerpt.rendered).slice(0, 155),
    excerpt: stripTags(p.excerpt.rendered).split(' ').slice(0, 30).join(' '),
    category: (p._embedded && p._embedded['wp:term'] && p._embedded['wp:term'][0][0] && p._embedded['wp:term'][0][0].name) || 'Insights',
    author: (p._embedded && p._embedded.author && p._embedded.author[0] && p._embedded.author[0].name) || 'Nordic SOC',
    date: p.date, modified: p.modified || p.date,
    hero_image: (p._embedded && p._embedded['wp:featuredmedia'] && p._embedded['wp:featuredmedia'][0] && p._embedded['wp:featuredmedia'][0].source_url) || '',
    hero_image_alt: (p._embedded && p._embedded['wp:featuredmedia'] && p._embedded['wp:featuredmedia'][0] && p._embedded['wp:featuredmedia'][0].alt_text) || '',
    reading_time: readMins(p.content.rendered),
    faq: (p.acf && Array.isArray(p.acf.faq)) ? p.acf.faq : [],
    body: p.content.rendered,
  }));
}
function loadLocal() {
  const dir = path.join(SITE, 'blog-content');
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const hf = path.join(dir, m.slug + '.html');
    m.body = fs.existsSync(hf) ? fs.readFileSync(hf, 'utf8') : '';
    m.modified = m.modified || m.date;
    if (!m.reading_time) m.reading_time = readMins(m.body);
    return m;
  });
}

// Rewrite content links to clean (pretty) URLs
function rewriteBody(html) {
  return String(html)
    .replace(/href="\/blog\.(?:php|html)\?slug=([a-z0-9-]+)"/g, 'href="/insights/$1/"')
    .replace(/href="\/insights\.(?:php|html)"/g, 'href="/insights/"')
    .replace(/href="\/vokter-partners\.html"/g, 'href="/partner-program/"')
    .replace(/href="\/about\.html"/g, 'href="/about-us/"')
    .replace(/href="\/contact\.html"/g, 'href="/contact-us/"')
    .replace(/href="\/(vokter-autonomous|vokter-hybrid|vokter-guardian)\.html"/g, 'href="/$1/"');
}

// ---- shared chrome (root-relative paths + clean URLs) ----
function style() {
  return '<style>' + CSS.replace(/url\("assets\//g, 'url("/assets/') + '</style>';
}
function nav(active) {
  return `<header class="nav" id="nav"><div class="nav-inner">
  <a class="brand" href="/" aria-label="Nordic SOC home"><img class="logo-nsoc" src="/assets/nordic-soc-navy.svg" alt="Nordic SOC"></a>
  <nav class="nav-links">
    <div class="nav-item"><button class="nav-trigger" aria-haspopup="true">Vokter Modes <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="drop"><a href="/vokter-autonomous/">Autonomous</a><a href="/vokter-hybrid/">Hybrid</a><a href="/vokter-guardian/">Guardian</a></div></div>
    <a href="/partner-program/">Partner Program</a>
    <a href="/insights/"${active ? ' class="active"' : ''}>Insights</a>
    <a href="/about-us/">About Us</a>
  </nav>
  <div class="nav-cta"><a href="/contact-us/" class="btn btn-primary">Contact Us</a></div>
  <button class="menu-toggle" id="menuToggle" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18" stroke-linecap="round"/></svg></button>
</div></header>
<div class="mobile-menu" id="mobileMenu">
  <a href="/vokter-autonomous/">Vokter Autonomous</a><a href="/vokter-hybrid/">Vokter Hybrid</a><a href="/vokter-guardian/">Vokter Guardian</a>
  <a href="/partner-program/">Partner Program</a><a href="/insights/">Insights</a><a href="/about-us/">About Us</a>
  <a href="/contact-us/" class="btn btn-primary">Contact Us</a>
</div>`;
}
function footer() {
  return `<footer><div class="wrap"><div class="foot-top">
  <div class="foot-brand"><img class="logo-nsoc" src="/assets/nordic-soc-white.svg" alt="Nordic SOC">
    <p>Managed security operations for the Nordics — powered by Vokter, our EU-sovereign AI SOC.</p>
    <div class="foot-contact">
      <a href="tel:+46733690899" class="foot-contact-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11.5a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .84h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.72a16 16 0 006.29 6.29l1.25-1.25a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg> +46 733 690899</a>
      <a href="mailto:consult@gsecurelabs.com" class="foot-contact-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg> consult@gsecurelabs.com</a>
      <span class="foot-contact-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> Isafjordsgatan 30A, 16440 Kista, Sweden</span>
    </div></div>
  <div class="foot-col"><ul>
    <li><a href="/vokter-autonomous/">Vokter Autonomous</a></li><li><a href="/vokter-hybrid/">Vokter Hybrid</a></li>
    <li><a href="/vokter-guardian/">Vokter Guardian</a></li><li><a href="/partner-program/">Partner Program</a></li>
    <li><a href="/insights/">Insights</a></li><li><a href="/about-us/">About Us</a></li><li><a href="/contact-us/">Contact Us</a></li>
  </ul></div>
  <div class="foot-offices"><h5>Global Offices:</h5><ul>
    <li>Belgium</li><li>Canada</li><li>Denmark</li><li>Finland</li><li>France</li><li>Germany</li><li>India</li><li>Iceland</li><li>Norway</li><li>South Africa</li><li>The Netherlands</li><li>UAE</li><li>UK</li><li>USA</li>
  </ul></div>
  </div>
  <div class="foot-bottom"><div class="foot-legal"><a href="#">Privacy Policy</a><a href="#">Terms of Use</a></div><span>&copy; 2026 Nordic SOC. All rights reserved.</span></div>
</div></footer>`;
}
const scriptTag = `<script>
const nav=document.getElementById('nav');const os=()=>nav.classList.toggle('scrolled',window.scrollY>16);os();addEventListener('scroll',os,{passive:true});
const t=document.getElementById('menuToggle'),m=document.getElementById('mobileMenu');
if(t&&m){t.onclick=()=>m.classList.toggle('open');m.querySelectorAll('a').forEach(a=>a.onclick=()=>m.classList.remove('open'));}
const io=new IntersectionObserver(e=>e.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target);}}),{threshold:.1,rootMargin:'0px 0px -6% 0px'});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
const fb=document.querySelectorAll('.filter');
if(fb.length){fb.forEach(b=>b.onclick=()=>{fb.forEach(x=>x.classList.remove('active'));b.classList.add('active');const c=b.dataset.cat;document.querySelectorAll('.pcard').forEach(k=>{k.style.display=(c==='all'||k.dataset.cat===c)?'':'none';});});}
const tl={};document.querySelectorAll('.toc a').forEach(a=>tl[a.getAttribute('href').slice(1)]=a);
const hd=[...document.querySelectorAll('.art-body h2[id]')];
if(hd.length&&Object.keys(tl).length){const spy=()=>{const L=Math.max(110,innerHeight*0.28);let c=hd[0];for(const h of hd){if(h.getBoundingClientRect().top<=L)c=h;else break;}for(const k in tl){tl[k].classList.remove('active');tl[k].parentElement.classList.remove('active');}if(c&&tl[c.id]){tl[c.id].classList.add('active');tl[c.id].parentElement.classList.add('active');}};addEventListener('scroll',spy,{passive:true});addEventListener('resize',spy,{passive:true});spy();}
</script>`;

function card(p) {
  const href = `/insights/${esc(p.slug)}/`;
  const img = p.hero_image ? `<img src="${esc(p.hero_image)}" alt="${esc(p.title)}" loading="lazy">` : '';
  return `<a class="pcard reveal" data-cat="${esc(p.category)}" href="${href}">
  <div class="thumb">${img}</div>
  <div class="pbody"><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p>
  <span class="more">Read article ${arrow}</span></div></a>`;
}

function renderIndex(posts) {
  const cats = [...new Set(posts.map(p => p.category).filter(Boolean))].sort();
  const items = posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/insights/${p.slug}/`, name: p.title }));
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': SITE_URL + '/#org', name: 'Nordic SOC', url: SITE_URL, description: 'EU-sovereign AI SOC and managed security operations for the Nordics, powered by Vokter.' },
    { '@type': 'Blog', '@id': SITE_URL + '/insights/#blog', name: 'Nordic SOC Insights', url: SITE_URL + '/insights/', publisher: { '@id': SITE_URL + '/#org' }, about: ['AI SOC', 'Autonomous security operations', 'Managed Detection and Response', 'EU data sovereignty', 'DORA', 'NIS2'] },
    { '@type': 'ItemList', itemListElement: items },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: SITE_URL + '/insights/' }] },
  ] };
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Insights — AI SOC, Autonomous Security &amp; EU Sovereignty | Nordic SOC</title>
<meta name="description" content="Expert insights on AI SOC, autonomous and agentic security operations, MDR, DORA and NIS2 compliance, and EU-sovereign cyber defence — from Nordic SOC in Stockholm.">
<link rel="canonical" href="${SITE_URL}/insights/">
<meta property="og:title" content="Insights — AI SOC &amp; EU-Sovereign Security | Nordic SOC"><meta property="og:type" content="website"><meta property="og:url" content="${SITE_URL}/insights/">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&display=swap" rel="stylesheet">
${style()}
<script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>
${nav(true)}
<main id="top">
  <section class="phero"><div class="phero-bg"></div><div class="wrap">
    <div class="eyebrow">Insights</div><h1>Security operations, <span class="accent">decoded.</span></h1>
    <p class="sub">Field-tested thinking on autonomous security operations, EU data sovereignty, DORA and NIS2 — and how AI is changing the way the Nordics defend.</p>
  </div></section>
  <section class="section"><div class="wrap">
    <div class="posts">${posts.map(p => card(p)).join('\n')}</div>
  </div></section>
</main>
${footer()}
${scriptTag}
</body></html>`;
}

function renderPost(p, all) {
  const url = `${SITE_URL}/insights/${p.slug}/`;
  // build a table of contents from H2s and inject ids
  const toc = [];
  const used = {};
  const body = rewriteBody(p.body).replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (m, attrs, inner) => {
    if (/id=/.test(attrs || '')) return m;
    const text = inner.replace(/<[^>]+>/g, '').trim();
    let id = text.toLowerCase().replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';
    if (used[id]) { used[id]++; id = id + '-' + used[id]; } else { used[id] = 1; }
    toc.push({ id, text });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  const tocHtml = toc.length >= 3
    ? `<aside class="toc"><h4>On this page</h4><ul>${toc.map(t => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ul></aside>`
    : '';
  let rel = all.filter(x => x.slug !== p.slug && x.category === p.category);
  for (const x of all) { if (rel.length >= 3) break; if (x.slug !== p.slug && !rel.includes(x)) rel.push(x); }
  rel = rel.slice(0, 3);
  const faqHtml = (p.faq && p.faq.length) ? `<div class="faq"><h2>Frequently asked questions</h2>${p.faq.map(f => `<details><summary>${esc(f.q)}</summary><div class="a">${esc(f.a)}</div></details>`).join('')}</div>` : '';
  const graph = [
    { '@type': 'BlogPosting', '@id': url + '#article', headline: p.title, description: p.meta_description || p.excerpt, datePublished: p.date, dateModified: p.modified || p.date, author: { '@type': 'Organization', name: p.author || 'Nordic SOC' }, publisher: { '@type': 'Organization', name: 'Nordic SOC', url: SITE_URL }, mainEntityOfPage: url, articleSection: p.category, inLanguage: 'en', ...(p.hero_image ? { image: p.hero_image } : {}), ...(p.focus_keyword ? { keywords: p.focus_keyword } : {}) },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: SITE_URL + '/insights/' },
      { '@type': 'ListItem', position: 3, name: p.title, item: url }] },
  ];
  if (p.faq && p.faq.length) graph.push({ '@type': 'FAQPage', mainEntity: p.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  const ld = { '@context': 'https://schema.org', '@graph': graph };
  const hero = p.hero_image ? `<div class="art-hero"><img src="${esc(p.hero_image)}" alt="${esc(p.hero_image_alt || p.title)}"></div>` : `<div class="art-hero"></div>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.meta_title || p.title)}${/Nordic SOC/.test(p.meta_title || '') ? '' : ' | Nordic SOC'}</title>
<meta name="description" content="${esc(p.meta_description || p.excerpt)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.meta_description || p.excerpt)}"><meta property="og:type" content="article"><meta property="og:url" content="${url}">${p.hero_image ? `<meta property="og:image" content="${esc(p.hero_image)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&display=swap" rel="stylesheet">
${style()}
<script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>
${nav(true)}
<main id="top"><article class="section" style="padding-top:128px"><div class="wrap">
  <div class="${toc.length >= 3 ? 'article-layout' : 'article-solo'}">
  <div class="article">
  <h1>${esc(p.title)}</h1>
  ${hero}
  <div class="art-body">${body}
  ${faqHtml}
  <div class="art-cta"><h3>See Vokter on your own alerts</h3><p>Book a walkthrough with our Nordic team and watch the AI SOC triage, investigate and contain — in seconds.</p><a href="/contact-us/" class="btn btn-primary">Request a demo ${arrow}</a></div>
  </div>
  ${rel.length ? `<div class="related"><h2>More insights</h2><div class="posts">${rel.map(r => card(r)).join('\n')}</div></div>` : ''}
  </div>
  ${tocHtml}
  </div>
</div></article></main>
${footer()}
${scriptTag}
</body></html>`;
}

(async () => {
  let posts;
  if (WP) { console.log('Source: WordPress API', WP); posts = await loadWP(); }
  else { console.log('Source: local blog-content/'); posts = loadLocal(); }
  posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  fs.mkdirSync(OUT_POSTS, { recursive: true });
  fs.writeFileSync(path.join(OUT_POSTS, 'index.html'), renderIndex(posts));
  for (const p of posts) fs.writeFileSync(path.join(OUT_POSTS, p.slug + '.html'), renderPost(p, posts));
  console.log(`Built insights/index.html + ${posts.length} post pages in /insights/`);
})().catch(e => { console.error('Build failed:', e.message); process.exit(1); });
