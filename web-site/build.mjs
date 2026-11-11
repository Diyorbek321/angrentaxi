#!/usr/bin/env node
// Saytni yig'ish: src/ → dist/. Bog'liqlik yo'q, faqat Node 20+.
//
//   node build.mjs                 # site.config.json dagi domen
//   DOMAIN=angrentaxi.uz node build.mjs
//
// CSS/JS nomiga kontent xeshi qo'shiladi — ular bir yil keshlanadi, HTML esa
// har safar yangidan so'raladi (web-site/Caddyfile).

import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import uz from './src/content/uz.mjs';
import ru from './src/content/ru.mjs';
import { renderNotFound, renderPage } from './src/render.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Sozlamani o'qiydi va tekshiradi; DOMAIN muhit o'zgaruvchisi ustun turadi. */
export async function loadConfig(env = process.env) {
  const raw = JSON.parse(await readFile(join(ROOT, 'site.config.json'), 'utf8'));
  const domain = (env.DOMAIN || raw.domain || '').trim().toLowerCase();
  if (!DOMAIN_RE.test(domain)) {
    throw new Error(`Noto'g'ri domen: "${domain}" (masalan: angrentaxi.uz)`);
  }
  const { _izoh, ...cfg } = raw;
  return { ...cfg, domain };
}

function hashName(name, content) {
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 10);
  const dot = name.lastIndexOf('.');
  return `${name.slice(0, dot)}.${hash}${name.slice(dot)}`;
}

function sitemap(cfg) {
  const site = `https://${cfg.domain}`;
  const today = new Date().toISOString().slice(0, 10);
  const entry = (t) => `  <url>
    <loc>${site}${t.path}</loc>
    <lastmod>${today}</lastmod>
    <xhtml:link rel="alternate" hreflang="${uz.htmlLang}" href="${site}${uz.path}"/>
    <xhtml:link rel="alternate" hreflang="${ru.htmlLang}" href="${site}${ru.path}"/>
  </url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entry(uz)}
${entry(ru)}
</urlset>
`;
}

export async function build({ outDir = join(ROOT, 'dist'), env = process.env } = {}) {
  const cfg = await loadConfig(env);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, 'assets'), { recursive: true });
  await mkdir(join(outDir, 'ru'), { recursive: true });

  const assets = {};
  for (const [key, file] of [['css', 'site.css'], ['js', 'site.js']]) {
    const content = await readFile(join(ROOT, 'src/assets', file));
    const name = hashName(file, content);
    await writeFile(join(outDir, 'assets', name), content);
    assets[key] = `/assets/${name}`;
  }
  await cp(join(ROOT, 'src/assets/static'), join(outDir, 'static'), { recursive: true });

  const files = {
    'index.html': renderPage(uz, ru, cfg, assets),
    'ru/index.html': renderPage(ru, uz, cfg, assets),
    '404.html': renderNotFound(uz, ru, cfg, assets),
    'robots.txt': `User-agent: *\nAllow: /\n\nSitemap: https://${cfg.domain}/sitemap.xml\n`,
    'sitemap.xml': sitemap(cfg),
  };
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(outDir, name), content);
  }
  return { cfg, assets, files: Object.keys(files) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build()
    .then(({ cfg, files }) => {
      process.stdout.write(`Sayt yig'ildi: ${cfg.domain} → dist/ (${files.join(', ')})\n`);
      const missing = [];
      if (!cfg.contacts.phone) missing.push('contacts.phone');
      if (!cfg.contacts.email && !cfg.contacts.telegram) missing.push('contacts.email/telegram');
      if (!cfg.operatorName) missing.push('operatorName');
      if (missing.length) process.stderr.write(`Ogohlantirish: to'ldirilmagan — ${missing.join(', ')}\n`);
    })
    .catch((err) => {
      process.stderr.write(`Yig'ish xatosi: ${err.message}\n`);
      process.exit(1);
    });
}
