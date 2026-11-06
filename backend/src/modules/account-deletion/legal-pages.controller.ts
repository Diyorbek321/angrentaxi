import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SettingsService } from '../settings/settings.service';
import {
  accountDeletionPage,
  LegalContext,
  LegalLang,
  LegalPage,
  privacyPolicy,
} from './legal-pages.content';
import { termsPage } from '../legal/legal-terms.content';
import { driverTermsPage } from '../legal/legal-driver-terms.content';
import { vendorTermsPage } from '../legal/legal-vendor-terms.content';
import { TermsContext } from '../legal/legal-terms-context';
import { legalPolicy } from '../legal/legal-policy';
import { LEGAL_VERSIONS } from '../legal/legal-versions';

/**
 * Maxfiylik siyosati oxirgi marta o'zgargan sana — versiyadan olinadi
 * (`LEGAL_VERSIONS.privacy`): matn o'zgarsa, o'sha yerda versiyani oshiring.
 */
const LEGAL_UPDATED = LEGAL_VERSIONS.privacy.version.slice(0, 10);

/**
 * Ommaviy huquqiy sahifalar (Google Play: maxfiylik siyosati URL va hisobni
 * o'chirish URL). Avtorizatsiyasiz, oddiy HTML — JSON konvertsiz (`@Res`).
 *   GET /api/v1/legal/privacy?lang=uz|ru
 *   GET /api/v1/legal/account-deletion?lang=uz|ru
 *   GET /api/v1/legal/terms?lang=uz|ru          — foydalanuvchi ofertasi (QORALAMA)
 *   GET /api/v1/legal/driver-terms?lang=uz|ru   — haydovchi/kuryer ofertasi (QORALAMA)
 *   GET /api/v1/legal/vendor-terms?lang=uz|ru   — sotuvchi shartlari (QORALAMA)
 *
 * Versiyalar va rozilik — `modules/legal` (`LEGAL_VERSIONS`, `/legal/acceptance`).
 */
@ApiExcludeController()
@Controller('legal')
export class LegalPagesController {
  constructor(
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  @Get('privacy')
  async privacy(@Req() req: Request, @Res() res: Response, @Query('lang') lang?: string): Promise<void> {
    const l = pickLang(lang);
    res.type('html').send(render(l, privacyPolicy(l, await this.context(req)), siteUrlOf(req)));
  }

  @Get('account-deletion')
  async deletion(@Req() req: Request, @Res() res: Response, @Query('lang') lang?: string): Promise<void> {
    const l = pickLang(lang);
    res.type('html').send(render(l, accountDeletionPage(l, await this.context(req)), siteUrlOf(req)));
  }

  @Get('terms')
  async terms(@Req() req: Request, @Res() res: Response, @Query('lang') lang?: string): Promise<void> {
    const l = pickLang(lang);
    res.type('html').send(render(l, termsPage(l, await this.termsContext(req)), siteUrlOf(req)));
  }

  @Get('driver-terms')
  async driverTerms(@Req() req: Request, @Res() res: Response, @Query('lang') lang?: string): Promise<void> {
    const l = pickLang(lang);
    res.type('html').send(render(l, driverTermsPage(l, await this.termsContext(req)), siteUrlOf(req)));
  }

  @Get('vendor-terms')
  async vendorTerms(@Req() req: Request, @Res() res: Response, @Query('lang') lang?: string): Promise<void> {
    const l = pickLang(lang);
    res.type('html').send(render(l, vendorTermsPage(l, await this.termsContext(req)), siteUrlOf(req)));
  }

  /**
   * Oferta raqamlari: komissiya — sahifa ochilgan paytdagi JONLI sozlama;
   * qolganlari hozircha docs/INCIDENT-POLICY.md standartlari (sozlamalari
   * keyingi bosqichlarda qo'shiladi — `legal-policy.ts`).
   */
  private async termsContext(req: Request): Promise<TermsContext> {
    const base = await this.context(req);
    const root = base.privacyUrl.replace(/\/privacy$/, '');
    let commissionRate: number | undefined;
    try {
      commissionRate = Number(await this.settings.getDefaultCommissionRate());
    } catch {
      commissionRate = undefined; // sahifa baribir ochilsin — standart qiymat
    }
    return {
      ...base,
      termsUrl: `${root}/terms`,
      driverTermsUrl: `${root}/driver-terms`,
      vendorTermsUrl: `${root}/vendor-terms`,
      policy: legalPolicy({ commissionRate }),
    };
  }

  private async context(req: Request): Promise<LegalContext> {
    const pub = await this.settings.getPublicSettings();
    const base = `${req.protocol}://${req.get('host')}/api/v1/legal`;
    return {
      // Rasmiy nom (YaTT/MChJ) — `LEGAL_OPERATOR_NAME`; berilmasa platforma nomi.
      operator: this.config.get<string>('LEGAL_OPERATOR_NAME') || pub.platformName || 'Angren Taxi',
      supportPhone: pub.supportPhone || '—',
      updated: LEGAL_UPDATED,
      privacyUrl: `${base}/privacy`,
      deletionUrl: `${base}/account-deletion`,
    };
  }
}

function pickLang(lang?: string): LegalLang {
  return lang === 'ru' ? 'ru' : 'uz';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Korporativ sayt manzili: `api.<domen>` → `https://<domen>`. Host sarlavhasi
 * qat'iy tekshiriladi (faqat domen belgilari) — aks holda havola chiqmaydi.
 */
export function siteUrlOf(req: Pick<Request, 'protocol' | 'get'>): string | undefined {
  const host = req.get('host') ?? '';
  if (!/^api\.[a-z0-9.-]+$/i.test(host)) return undefined;
  return `${req.protocol}://${host.slice(4)}`;
}

/** Sayt brendi: sariq #F5C518 fon + qora matn; matn urg'usi #7A5B00. Doim yorug'. */
const LEGAL_CSS = `*{box-sizing:border-box}
body{margin:0;font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1A1A1A;background:#F7F6F2}
a{color:#1A1A1A;text-underline-offset:3px}a:hover{text-decoration-color:#F5C518;text-decoration-thickness:3px}
:focus-visible{outline:3px solid #1A1A1A;outline-offset:3px;border-radius:6px}
.top{position:sticky;top:0;z-index:2;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border-bottom:1px solid #EEEADF}
.top-in,.wrap{max-width:820px;margin:0 auto;padding:0 16px}
.top-in{display:flex;align-items:center;justify-content:space-between;gap:12px;height:64px}
.brand{display:inline-flex;align-items:center;gap:10px;font-weight:800;font-size:17px;letter-spacing:-.01em;text-decoration:none}
.mark{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#F5C518;font-size:14px;font-weight:900;letter-spacing:-.04em}
.lang{display:inline-flex;align-items:center;min-height:38px;padding:0 14px;border:1.5px solid #EEEADF;border-radius:999px;font-size:14px;font-weight:700;text-decoration:none}
.lang:hover{border-color:#1A1A1A}
.checker{height:10px;background:repeating-conic-gradient(#1A1A1A 0 25%,#F5C518 0 50%) 0 0/10px 10px}
.doc{margin:28px auto 48px;padding:clamp(20px,5vw,48px);background:#fff;border:1px solid #EEEADF;border-radius:24px;box-shadow:0 14px 34px -18px rgba(26,26,26,.18)}
.kicker{display:inline-flex;align-items:center;gap:10px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7A5B00}
.kicker:before{content:"";width:24px;height:4px;border-radius:4px;background:#F5C518}
h1{margin:12px 0 10px;font-size:clamp(26px,4.5vw,36px);line-height:1.15;letter-spacing:-.02em}
.intro{color:#5F5B52;font-size:17px}
h2{position:relative;margin:34px 0 10px;padding-left:16px;font-size:19px;line-height:1.3}
h2:before{content:"";position:absolute;left:0;top:3px;bottom:3px;width:5px;border-radius:4px;background:#F5C518}
p{margin:0 0 10px}ul{margin:0 0 10px;padding-left:22px}li{margin:4px 0}li::marker{color:#7A5B00}
.draft{display:flex;gap:10px;margin:0 0 20px;padding:12px 16px;border:2px dashed #F5C518;background:#FFF6D1;color:#4A3A00;border-radius:14px;font-weight:600;font-size:15px}
.foot{padding:0 0 40px;color:#5F5B52;font-size:14px;text-align:center}
@media print{.top,.checker{display:none}body{background:#fff}.doc{border:0;box-shadow:none;margin:0;padding:0}}`;

function render(lang: LegalLang, page: LegalPage, siteUrl?: string): string {
  const other = lang === 'uz' ? { code: 'ru', label: 'Русский' } : { code: 'uz', label: "O'zbekcha" };
  const sections = page.sections
    .map(
      (s) =>
        `<h2>${esc(s.h)}</h2>` +
        (s.p ?? []).map((p) => `<p>${esc(p)}</p>`).join('') +
        (s.li ? `<ul>${s.li.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''),
    )
    .join('');
  const draft = page.draft ? `<p class="draft" role="note">${esc(page.draft)}</p>` : '';
  const home = siteUrl ? `${siteUrl}${lang === 'ru' ? '/ru/' : '/'}` : undefined;
  const brandInner = '<span class="mark" aria-hidden="true">AT</span>Angren Taxi';
  const brand = home
    ? `<a class="brand" href="${esc(home)}">${brandInner}</a>`
    : `<span class="brand">${brandInner}</span>`;
  const kicker = lang === 'ru' ? 'Документ' : 'Hujjat';
  const back = home
    ? `<p class="foot"><a href="${esc(`${home}#docs`)}">${lang === 'ru' ? '← Все документы' : '← Barcha hujjatlar'}</a></p>`
    : '';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<meta name="theme-color" content="#F5C518"><title>${esc(page.title)} — Angren Taxi</title>
<style>${LEGAL_CSS}</style></head>
<body><header class="top"><div class="top-in">${brand}<nav><a class="lang" href="?lang=${other.code}" hreflang="${other.code}">${other.label}</a></nav></div></header>
<div class="checker" aria-hidden="true"></div>
<main class="wrap"><article class="doc">${draft}<p class="kicker">${kicker}</p><h1>${esc(page.title)}</h1><p class="intro">${esc(page.intro)}</p>${sections}</article></main>
${back}</body></html>`;
}
