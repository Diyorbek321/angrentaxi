// Sahifa shabloni: matn (content/*.mjs) + sozlama (site.config.json) → HTML.
// Hech qanday tashqi bog'liqlik yo'q. Barcha matn `esc()` orqali o'tadi.

import { icon } from './icons.mjs';

export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const text = (v, cfg) => (typeof v === 'function' ? v(cfg) : v);

const CARS = ['car_econom', 'car_comfort', 'car_business', 'car_van'];

/** Sozlamadagi bo'sh bo'lmagan aloqa kanallari — null bo'lganlar ko'rsatilmaydi. */
export function contactChannels(cfg, lang) {
  const c = cfg.contacts ?? {};
  const out = [];
  if (c.phone) out.push({ kind: 'phone', icon: 'phone', value: c.phone, href: `tel:${c.phone.replace(/[^+\d]/g, '')}` });
  if (c.telegram) {
    const handle = c.telegram.replace(/^@/, '');
    out.push({ kind: 'telegram', icon: 'send', value: `@${handle}`, href: `https://t.me/${handle}` });
  }
  if (c.email) out.push({ kind: 'email', icon: 'mail', value: c.email, href: `mailto:${c.email}` });
  if (c.address?.[lang]) out.push({ kind: 'address', icon: 'pin', value: c.address[lang], href: null });
  if (c.hours?.[lang]) out.push({ kind: 'hours', icon: 'clock', value: c.hours[lang], href: null });
  return out;
}

function urls(cfg, t) {
  const site = `https://${cfg.domain}`;
  const api = `https://api.${cfg.domain}/api/v1`;
  return {
    site,
    canonical: `${site}${t.path}`,
    privacy: `${api}/legal/privacy?lang=${t.lang}`,
    deletion: `${api}/legal/account-deletion?lang=${t.lang}`,
  };
}

function logo(brand) {
  return `<span class="logo"><img src="/static/logo.svg" width="36" height="36" alt=""><span class="logo-word">${esc(brand)}</span></span>`;
}

function header(t, other, cfg, assets) {
  const n = t.nav;
  const links = [
    ['services', n.services],
    ['safety', n.safety],
    ['drivers', n.drivers],
    ['partners', n.partners],
    ['faq', n.faq],
    ['contact', n.contact],
  ]
    .map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`)
    .join('');
  return `
<header class="site-header" data-header>
  <span class="scroll-progress" data-progress aria-hidden="true"></span>
  <div class="container header-row">
    <a class="brand-link" href="${t.path}" aria-label="${esc(cfg.brand)} — ${esc(n.home)}">${logo(cfg.brand)}</a>
    <nav class="main-nav" id="main-nav" aria-label="${esc(n.menu)}" data-nav>
      <ul>${links}</ul>
      <div class="nav-actions">
        <a class="lang-switch" href="${other.path}" hreflang="${other.htmlLang}" lang="${other.htmlLang}">${icon('globe')}<span>${esc(other.langShort)}</span><span class="sr-only">${esc(other.langName)}</span></a>
        <a class="btn btn-primary btn-sm" href="#download">${esc(n.download)}</a>
      </div>
    </nav>
    <button class="menu-toggle" type="button" aria-controls="main-nav" aria-expanded="false" data-menu-toggle data-label-open="${esc(n.menu)}" data-label-close="${esc(n.close)}">
      <span class="sr-only" data-menu-label>${esc(n.menu)}</span>${icon('menu', 'ic ic-open')}${icon('close', 'ic ic-close')}
    </button>
  </div>
</header>`;
}

function phoneMock(t) {
  const m = t.mock;
  const tariffs = m.tariffs
    .map(
      (name, i) => `<li class="${i === 0 ? 'is-active' : ''}"><img src="/static/img/${CARS[i]}.svg" width="60" height="26" alt="" loading="lazy"><span>${esc(name)}</span></li>`,
    )
    .join('');
  return `
<div class="hero-visual" aria-hidden="true">
  <div class="phone">
    <div class="phone-screen">
      <svg class="map" viewBox="0 0 300 380" preserveAspectRatio="xMidYMid slice">
        <rect width="300" height="380" class="map-bg"/>
        <g class="map-blocks">
          <rect x="18" y="20" width="84" height="70" rx="8"/><rect x="122" y="20" width="70" height="70" rx="8"/><rect x="212" y="20" width="76" height="110" rx="8"/>
          <rect x="18" y="110" width="84" height="96" rx="8"/><rect x="122" y="110" width="70" height="44" rx="8"/><rect x="122" y="174" width="70" height="80" rx="8"/>
          <rect x="212" y="150" width="76" height="104" rx="8"/><rect x="18" y="226" width="84" height="130" rx="8"/><rect x="122" y="274" width="166" height="82" rx="8"/>
        </g>
        <path class="map-park" d="M212 150h76v104h-76z"/>
        <path class="route" d="M60 330 V216 H112 V100 H202 V60 H250"/>
        <path class="route-live" d="M60 330 V216 H112 V100 H202 V60 H250"/>
        <circle class="pin-ping" cx="250" cy="60" r="16"/>
        <circle class="pin-to" cx="250" cy="60" r="8"/>
        <g class="car-move">
          <circle r="11" class="car-halo"/>
          <circle r="7.5" class="car-dot"/>
          <animateMotion dur="7s" begin="2.6s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear" path="M60 330 V216 H112 V100 H202 V60 H250"/>
        </g>
      </svg>
      <div class="sheet">
        <span class="sheet-grip"></span>
        <p class="sheet-title">${esc(m.greeting)}</p>
        <div class="addr"><span class="addr-dot from"></span>${esc(m.from)}</div>
        <div class="addr"><span class="addr-dot to"></span>${esc(m.to)}</div>
        <ul class="tariffs">${tariffs}</ul>
        <p class="sheet-note">${icon('check')}${esc(m.priceNote)}</p>
        <span class="sheet-btn">${esc(m.button)}</span>
      </div>
    </div>
  </div>
  <div class="float-card">
    <span class="float-icon">${icon('car')}</span>
    <span><strong>${esc(m.driverTitle)}</strong><small>${esc(m.driverEta)}</small></span>
  </div>
</div>`;
}

/** Sarlavha so'zlari — har biri alohida chiqishi uchun (faqat bezak). */
function words(str) {
  // Yolg'iz tire oldingi so'zga yopishadi — qator boshiga tushmasin.
  const parts = str.split(' ').reduce((acc, w) => (/^[—–-]$/.test(w) && acc.length ? [...acc.slice(0, -1), `${acc.at(-1)}\u00a0${w}`] : [...acc, w]), []);
  return parts.map((w) => `<span class="w">${esc(w)}</span>`).join(' ');
}

/** Xizmatlar lentasi: ikki marta takrorlanadi — CSS uni uzluksiz suradi. */
function marquee(t) {
  const items = [...t.services.items.map((s) => [s.icon, s.title]), ...t.safety.items.slice(0, 3).map((s) => [s.icon, s.title])];
  const row = items.map(([ic, title]) => `<li>${icon(ic)}<span>${esc(title)}</span></li>`).join('');
  return `<div class="marquee" aria-hidden="true"><ul class="marquee-track">${row}${row}</ul></div>`;
}

function hero(t) {
  const h = t.hero;
  const chips = h.chips.map((c) => `<li>${icon('check')}${esc(c)}</li>`).join('');
  return `
<section class="hero" aria-labelledby="hero-title">
  <div class="container hero-grid">
    <div class="hero-copy">
      <p class="eyebrow"><span class="eyebrow-dot"></span>${esc(h.eyebrow)}</p>
      <h1 id="hero-title">${words(h.titleA)} <span class="mark"><span class="w">${esc(h.titleB)}</span></span></h1>
      <p class="lead">${esc(h.lead)}</p>
      <div class="cta-row">
        <a class="btn btn-primary btn-lg" href="#download">${esc(h.ctaPrimary)}${icon('arrow')}</a>
        <a class="btn btn-ghost btn-lg" href="#drivers">${esc(h.ctaSecondary)}</a>
      </div>
      <ul class="chips">${chips}</ul>
    </div>
    ${phoneMock(t)}
  </div>
</section>
${marquee(t)}`;
}

function sectionHead(kicker, title, lead, id) {
  return `<div class="section-head" data-reveal>
    <p class="kicker">${esc(kicker)}</p>
    <h2 id="${id}-title">${esc(title)}</h2>
    ${lead ? `<p class="section-lead">${esc(lead)}</p>` : ''}
  </div>`;
}

function services(t, cfg) {
  const s = t.services;
  const cards = s.items
    .map((it) => {
      const soon = it.flag && !cfg.services[it.flag];
      return `<li class="card service-card${soon ? ' is-soon' : ''}" data-reveal>
        <span class="tile">${icon(it.icon)}</span>
        <h3>${esc(it.title)}${soon ? ` <span class="badge">${esc(s.soon)}</span>` : ''}</h3>
        <p>${esc(it.text)}</p>
      </li>`;
    })
    .join('');
  return `
<section class="section" id="services" aria-labelledby="services-title">
  <div class="container">
    ${sectionHead(s.kicker, s.title, s.lead, 'services')}
    <ul class="grid grid-3">${cards}</ul>
  </div>
</section>`;
}

function steps(t) {
  const s = t.steps;
  const items = s.items
    .map(
      (it, i) => `<li class="step" data-reveal><span class="step-num">${i + 1}</span><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></li>`,
    )
    .join('');
  return `
<section class="section section-alt" id="how" aria-labelledby="how-title">
  <div class="container">
    ${sectionHead(s.kicker, s.title, null, 'how')}
    <ol class="steps" data-reveal>${items}</ol>
  </div>
</section>`;
}

function featureList(items, cls = '') {
  return items
    .map(
      (it) => `<li class="feature ${cls}" data-reveal><span class="tile">${icon(it.icon)}</span><div><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div></li>`,
    )
    .join('');
}

function safety(t) {
  const s = t.safety;
  return `
<section class="section" id="safety" aria-labelledby="safety-title">
  <div class="container split">
    <div class="split-head">
      ${sectionHead(s.kicker, s.title, s.lead, 'safety')}
      <div class="shield-art" aria-hidden="true">${icon('sos', 'ic ic-xl')}</div>
    </div>
    <ul class="features grid-2">${featureList(s.items)}</ul>
  </div>
</section>`;
}

function drivers(t, cfg) {
  const d = t.drivers;
  const join = d.join.map((step) => `<li>${esc(step)}</li>`).join('');
  const href = cfg.apps.driverPlayUrl ?? '#download';
  return `
<div class="checker" aria-hidden="true"></div>
<section class="section section-dark" id="drivers" aria-labelledby="drivers-title">
  <div class="container drivers-grid">
    <div>
      ${sectionHead(d.kicker, d.title, d.lead, 'drivers')}
      <ul class="features grid-2 on-dark">${featureList(d.perks)}</ul>
    </div>
    <aside class="join-card" data-reveal aria-labelledby="join-title">
      <h3 id="join-title">${esc(d.joinTitle)}</h3>
      <ol class="join-list">${join}</ol>
      <a class="btn btn-mint btn-lg btn-block" href="${esc(href)}">${esc(d.cta)}${icon('arrow')}</a>
      <p class="join-note">${esc(d.note)}</p>
    </aside>
  </div>
</section>
<div class="checker" aria-hidden="true"></div>`;
}

function partners(t) {
  const p = t.partners;
  const cards = p.items
    .map(
      (it) => `<li class="card" data-reveal><span class="tile">${icon(it.icon)}</span><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></li>`,
    )
    .join('');
  return `
<section class="section" id="partners" aria-labelledby="partners-title">
  <div class="container">
    <div class="head-row">
      ${sectionHead(p.kicker, p.title, p.lead, 'partners')}
      <a class="btn btn-ghost" href="#contact" data-reveal>${esc(p.cta)}${icon('arrow')}</a>
    </div>
    <ul class="grid grid-4">${cards}</ul>
  </div>
</section>`;
}

function company(t) {
  const c = t.company;
  const paras = c.paras.map((p) => `<p>${esc(p)}</p>`).join('');
  const values = c.values
    .map((v) => `<li class="value" data-reveal>${icon('check')}<div><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p></div></li>`)
    .join('');
  return `
<section class="section section-alt" id="company" aria-labelledby="company-title">
  <div class="container split">
    <div>
      ${sectionHead(c.kicker, c.title, null, 'company')}
      <div class="prose" data-reveal>${paras}</div>
    </div>
    <ul class="values">${values}</ul>
  </div>
</section>`;
}

function faq(t, cfg) {
  const f = t.faq;
  const items = f.items
    .map(
      (it) => `<details class="faq-item" data-reveal><summary>${esc(it.q)}<span class="faq-mark" aria-hidden="true"></span></summary><p>${esc(text(it.a, cfg))}</p></details>`,
    )
    .join('');
  return `
<section class="section" id="faq" aria-labelledby="faq-title">
  <div class="container narrow">
    ${sectionHead(f.kicker, f.title, null, 'faq')}
    <div class="faq">${items}</div>
  </div>
</section>`;
}

function appCard(label, url, t, iconName) {
  const action = url
    ? `<a class="btn btn-primary" href="${esc(url)}" rel="noopener">${icon('play')}${esc(t.apps.play)}</a>`
    : `<span class="badge badge-lg">${icon('clock')}${esc(t.apps.soon)}</span>`;
  return `<li class="app-card" data-reveal><span class="tile tile-lg">${icon(iconName)}</span><h3>${esc(label)}</h3>${action}</li>`;
}

function download(t, cfg) {
  return `
<section class="section download" id="download" aria-labelledby="download-title">
  <div class="container">
    <div class="download-panel">
      <div class="section-head" data-reveal>
        <p class="kicker">${esc(t.nav.download)}</p>
        <h2 id="download-title">${esc(t.apps.title)}</h2>
        <p class="section-lead">${esc(t.apps.lead)}</p>
      </div>
      <ul class="app-cards">
        ${appCard(t.apps.passenger, cfg.apps.passengerPlayUrl, t, 'pin')}
        ${appCard(t.apps.driver, cfg.apps.driverPlayUrl, t, 'car')}
      </ul>
    </div>
  </div>
</section>`;
}

function contact(t, cfg) {
  const c = t.contact;
  const channels = contactChannels(cfg, t.lang);
  const body = channels.length
    ? `<ul class="grid grid-3 contact-list">${channels
        .map((ch) => {
          const value = ch.href
            ? `<a href="${esc(ch.href)}"${ch.kind === 'telegram' ? ' rel="noopener"' : ''}>${esc(ch.value)}</a>`
            : `<span>${esc(ch.value)}</span>`;
          return `<li class="card contact-card" data-reveal><span class="tile">${icon(ch.icon)}</span><div><p class="contact-label">${esc(c[ch.kind])}</p>${value}</div></li>`;
        })
        .join('')}</ul>`
    : `<p class="pending" data-reveal>${icon('clock')}${esc(c.pending)}</p>`;
  return `
<section class="section section-alt" id="contact" aria-labelledby="contact-title">
  <div class="container">
    ${sectionHead(c.kicker, c.title, c.lead, 'contact')}
    ${body}
  </div>
</section>`;
}

function footer(t, cfg, u) {
  const n = t.nav;
  const f = t.footer;
  const owner = cfg.operatorName ?? cfg.brand;
  const sections = ['services', 'safety', 'drivers', 'partners', 'company', 'faq']
    .map((id) => `<li><a href="${t.path}#${id}">${esc(n[id])}</a></li>`)
    .join('');
  return `
<div class="checker" aria-hidden="true"></div>
<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      ${logo(cfg.brand)}
      <p>${esc(f.tagline)}</p>
    </div>
    <nav aria-label="${esc(f.sections)}"><p class="footer-title">${esc(f.sections)}</p><ul>${sections}</ul></nav>
    <nav aria-label="${esc(f.legal)}"><p class="footer-title">${esc(f.legal)}</p><ul>
      <li><a href="${esc(u.privacy)}">${esc(f.privacy)}</a></li>
      <li><a href="${esc(u.deletion)}">${esc(f.deletion)}</a></li>
    </ul></nav>
  </div>
  <div class="container footer-bottom">
    <p>© ${new Date().getFullYear()} ${esc(owner)}. ${esc(f.rights)}</p>
  </div>
</footer>`;
}

function jsonLd(cfg, t, u) {
  const contact = contactChannels(cfg, t.lang);
  const phone = contact.find((c) => c.kind === 'phone');
  const tg = contact.find((c) => c.kind === 'telegram');
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: cfg.brand,
    ...(cfg.operatorName ? { legalName: cfg.operatorName } : {}),
    url: u.site,
    logo: `${u.site}/static/logo.svg`,
    description: t.meta.description,
    areaServed: { '@type': 'City', name: cfg.city[t.lang] },
    ...(phone ? { contactPoint: { '@type': 'ContactPoint', telephone: phone.value, contactType: 'customer support', availableLanguage: ['uz', 'ru'] } } : {}),
    ...(tg ? { sameAs: [tg.href] } : {}),
  };
  // `</` ni yopib qo'yish — JSON ichidagi matn skript tegini yopa olmasin.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function head(t, other, cfg, assets, u) {
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(t.meta.title)}</title>
<meta name="description" content="${esc(t.meta.description)}">
<link rel="canonical" href="${esc(u.canonical)}">
<link rel="alternate" hreflang="${t.htmlLang}" href="${esc(u.canonical)}">
<link rel="alternate" hreflang="${other.htmlLang}" href="${esc(`${u.site}${other.path}`)}">
<link rel="alternate" hreflang="x-default" href="${esc(`${u.site}/`)}">
<meta name="theme-color" content="#F5C518">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/static/logo.svg" type="image/svg+xml">
<link rel="preload" href="/static/fonts/pjs-extrabold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/static/fonts/pjs-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${assets.css}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(cfg.brand)}">
<meta property="og:title" content="${esc(t.meta.title)}">
<meta property="og:description" content="${esc(t.meta.description)}">
<meta property="og:url" content="${esc(u.canonical)}">
<meta property="og:locale" content="${t.ogLocale}">
<meta property="og:image" content="${esc(`${u.site}/static/og.png`)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd(cfg, t, u)}</script>
<script src="${assets.js}" defer></script>
</head>`;
}

export function renderPage(t, other, cfg, assets) {
  const u = urls(cfg, t);
  return `<!doctype html>
<html lang="${t.htmlLang}">
${head(t, other, cfg, assets, u)}
<body>
<a class="skip-link" href="#main">${esc(t.nav.skip)}</a>
${header(t, other, cfg, assets)}
<main id="main">
${hero(t)}
${services(t, cfg)}
${steps(t)}
${safety(t)}
${drivers(t, cfg)}
${partners(t)}
${company(t)}
${faq(t, cfg)}
${download(t, cfg)}
${contact(t, cfg)}
</main>
${footer(t, cfg, u)}
</body>
</html>
`;
}

export function renderNotFound(uz, ru, cfg, assets) {
  const block = (t) => `<div class="nf-block" lang="${t.htmlLang}"><h1>${esc(t.notFound.title)}</h1><p>${esc(t.notFound.text)}</p><a class="btn btn-primary" href="${t.path}">${esc(t.notFound.back)}</a></div>`;
  return `<!doctype html>
<html lang="${uz.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 — ${esc(cfg.brand)}</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/static/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="${assets.css}">
</head>
<body class="nf">
<main class="container nf-main">
  <a class="brand-link" href="/">${logo(cfg.brand)}</a>
  <p class="nf-code">404</p>
  ${block(uz)}
  ${block(ru)}
</main>
</body>
</html>
`;
}
