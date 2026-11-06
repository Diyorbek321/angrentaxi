// node --test — sayt yig'ilishi, matn to'liqligi va xavfsizlik tekshiruvlari.
import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import uz from './src/content/uz.mjs';
import ru from './src/content/ru.mjs';
import { build, loadConfig } from './build.mjs';
import { contactChannels, esc, renderPage } from './src/render.mjs';
import { ICON_NAMES, icon } from './src/icons.mjs';

/** Obyekt tuzilmasi: kalit yo'llari va massiv uzunliklari (qiymatlarsiz). */
function shape(value, path = '') {
  if (Array.isArray(value)) return [`${path}[${value.length}]`, ...value.flatMap((v, i) => shape(v, `${path}[${i}]`))];
  if (value && typeof value === 'object') return Object.keys(value).sort().flatMap((k) => shape(value[k], `${path}.${k}`));
  return [`${path}:${typeof value}`];
}

const baseCfg = {
  brand: 'Angren Taxi',
  domain: 'example.uz',
  operatorName: null,
  city: { uz: 'Angren', ru: 'Ангрен' },
  contacts: { phone: null, email: null, telegram: null, address: { uz: null, ru: null }, hours: { uz: null, ru: null } },
  apps: { passengerPlayUrl: null, driverPlayUrl: null },
  services: { intercityLive: false, cardPaymentsLive: false },
};
const assets = { css: '/assets/site.x.css', js: '/assets/site.x.js' };

describe('matn', () => {
  it('uz va ru bir xil tuzilmada', () => {
    const strip = (t) => shape(t).filter((p) => !/^\.(lang|htmlLang|ogLocale|path|langName|langShort):/.test(p));
    assert.deepEqual(strip(ru), strip(uz));
  });

  it("bo'sh matn yo'q", () => {
    for (const t of [uz, ru]) {
      const walk = (v, p) => {
        if (typeof v === 'string') assert.ok(v.trim().length > 0, `${t.lang}${p} bo'sh`);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
        else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, `${p}.${k}`));
      };
      walk(t, '');
    }
  });

  it('ishlatilgan har bir ikona mavjud', () => {
    const used = [...uz.services.items, ...uz.safety.items, ...uz.drivers.perks, ...uz.partners.items].map((i) => i.icon);
    for (const name of used) assert.ok(ICON_NAMES.includes(name), name);
    assert.throws(() => icon('yoq-ikona'));
  });
});

describe('render', () => {
  it('HTML maxsus belgilarini qochiradi', () => {
    assert.equal(esc(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  });

  it("to'ldirilmagan aloqa ko'rsatilmaydi — soxta raqam chiqmaydi", () => {
    assert.deepEqual(contactChannels(baseCfg, 'uz'), []);
    const html = renderPage(uz, ru, baseCfg, assets);
    assert.match(html, /class="pending"/);
    assert.doesNotMatch(html, /tel:/);
    assert.doesNotMatch(html, /contactPoint/);
  });

  it('aloqa kanallari xavfsiz havolaga aylanadi', () => {
    const cfg = { ...baseCfg, contacts: { ...baseCfg.contacts, phone: '+998 70 123-45-67', telegram: '@angren_taxi', email: 'info@example.uz' } };
    const kinds = contactChannels(cfg, 'uz');
    assert.deepEqual(kinds.map((c) => c.href), ['tel:+998701234567', 'https://t.me/angren_taxi', 'mailto:info@example.uz']);
    const html = renderPage(uz, ru, cfg, assets);
    assert.match(html, /"telephone":"\+998 70 123-45-67"/);
  });

  it("flag o'chiq xizmatga 'Tez orada' belgisi, yoqilganda yo'q", () => {
    const off = renderPage(uz, ru, baseCfg, assets);
    assert.match(off, /Shaharlararo <span class="badge">Tez orada<\/span>/);
    const on = renderPage(uz, ru, { ...baseCfg, services: { ...baseCfg.services, intercityLive: true } }, assets);
    assert.doesNotMatch(on, /Shaharlararo <span class="badge">/);
  });

  it("karta to'lovi javobi sozlamaga bog'liq", () => {
    assert.match(renderPage(uz, ru, baseCfg, assets), /Hozircha naqd pul bilan/);
    const live = renderPage(uz, ru, { ...baseCfg, services: { ...baseCfg.services, cardPaymentsLive: true } }, assets);
    assert.match(live, /Naqd pul yoki bank kartasi bilan/);
  });

  it('Play havolasi berilsa tugma chiqadi', () => {
    const cfg = { ...baseCfg, apps: { passengerPlayUrl: 'https://play.google.com/store/apps/details?id=uz.angren.taxi.passenger', driverPlayUrl: null } };
    const html = renderPage(uz, ru, cfg, assets);
    assert.match(html, /details\?id=uz\.angren\.taxi\.passenger/);
    assert.match(html, /Google Playʼda tez orada/);
  });

  it("JSON-LD ichida skript tegi yopilmaydi", () => {
    const cfg = { ...baseCfg, operatorName: '</script><script>alert(1)</script>' };
    const html = renderPage(uz, ru, cfg, assets);
    const ld = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1];
    assert.doesNotMatch(ld, /<\/script/i);
    assert.equal(JSON.parse(ld).legalName, cfg.operatorName);
  });

  it("inline style va inline skript yo'q (CSP 'self')", () => {
    for (const t of [uz, ru]) {
      const html = renderPage(t, t === uz ? ru : uz, baseCfg, assets);
      assert.doesNotMatch(html, /\sstyle=/);
      assert.doesNotMatch(html, /\son[a-z]+=/);
      const scripts = [...html.matchAll(/<script([^>]*)>/g)].map((m) => m[1]);
      for (const attrs of scripts) assert.ok(/src=|application\/ld\+json/.test(attrs), attrs);
    }
  });

  it('hreflang juftligi va canonical', () => {
    const html = renderPage(ru, uz, baseCfg, assets);
    assert.match(html, /<html lang="ru">/);
    assert.match(html, /rel="canonical" href="https:\/\/example\.uz\/ru\/"/);
    assert.match(html, /hreflang="uz-Latn" href="https:\/\/example\.uz\/"/);
    assert.match(html, /legal\/privacy\?lang=ru/);
  });
});

describe('build', () => {
  let out;
  before(async () => {
    out = await mkdtemp(join(tmpdir(), 'site-'));
  });
  after(() => rm(out, { recursive: true, force: true }));

  it("DOMAIN muhit o'zgaruvchisi bilan to'liq yig'iladi", async () => {
    const { cfg, assets: a } = await build({ outDir: out, env: { DOMAIN: 'AngrenTaxi.uz' } });
    assert.equal(cfg.domain, 'angrentaxi.uz');
    for (const f of ['index.html', 'ru/index.html', '404.html', 'robots.txt', 'sitemap.xml', 'static/logo.svg', 'static/og.png']) {
      assert.ok((await stat(join(out, f))).size > 0, f);
    }
    assert.match(a.css, /^\/assets\/site\.[0-9a-f]{10}\.css$/);
    const index = await readFile(join(out, 'index.html'), 'utf8');
    assert.ok(index.includes(a.css) && index.includes(a.js));
    assert.match(await readFile(join(out, 'sitemap.xml'), 'utf8'), /https:\/\/angrentaxi\.uz\/ru\//);
  });

  it('HTML dagi har bir mahalliy havola mavjud faylga olib boradi', async () => {
    await build({ outDir: out, env: { DOMAIN: 'example.uz' } });
    for (const page of ['index.html', 'ru/index.html', '404.html']) {
      const html = await readFile(join(out, page), 'utf8');
      const refs = [...html.matchAll(/(?:src|href)="(\/(?:static|assets)\/[^"]+)"/g)].map((m) => m[1]);
      assert.ok(refs.length >= 3, page);
      for (const ref of refs) await stat(join(out, ref));
    }
    const css = await readFile(join(out, 'assets', (await readdir(join(out, 'assets'))).find((f) => f.endsWith('.css'))), 'utf8');
    for (const [, ref] of css.matchAll(/url\('(\/static\/[^']+)'\)/g)) await stat(join(out, ref));
  });

  it("noto'g'ri domen rad etiladi", async () => {
    await assert.rejects(loadConfig({ DOMAIN: 'evil.uz/"><script>' }), /Noto'g'ri domen/);
    await assert.rejects(loadConfig({ DOMAIN: 'localhost' }), /Noto'g'ri domen/);
  });
});
