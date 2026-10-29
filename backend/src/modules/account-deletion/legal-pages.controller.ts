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

/** Siyosat matni oxirgi marta o'zgargan sana — matn o'zgarsa yangilang. */
const LEGAL_UPDATED = '2026-10-29';

/**
 * Ommaviy huquqiy sahifalar (Google Play: maxfiylik siyosati URL va hisobni
 * o'chirish URL). Avtorizatsiyasiz, oddiy HTML — JSON konvertsiz (`@Res`).
 *   GET /api/v1/legal/privacy?lang=uz|ru
 *   GET /api/v1/legal/account-deletion?lang=uz|ru
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
    res.type('html').send(render(l, privacyPolicy(l, await this.context(req))));
  }

  @Get('account-deletion')
  async deletion(@Req() req: Request, @Res() res: Response, @Query('lang') lang?: string): Promise<void> {
    const l = pickLang(lang);
    res.type('html').send(render(l, accountDeletionPage(l, await this.context(req))));
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

function render(lang: LegalLang, page: LegalPage): string {
  const other = lang === 'uz' ? { code: 'ru', label: 'Русский' } : { code: 'uz', label: "O'zbekcha" };
  const sections = page.sections
    .map(
      (s) =>
        `<h2>${esc(s.h)}</h2>` +
        (s.p ?? []).map((p) => `<p>${esc(p)}</p>`).join('') +
        (s.li ? `<ul>${s.li.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''),
    )
    .join('');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)}</title>
<style>body{font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#111;background:#fff}
h1{font-size:24px;margin:0 0 8px}h2{font-size:18px;margin:28px 0 8px}a{color:#0a7}nav{margin-bottom:16px;font-size:14px}
@media (prefers-color-scheme:dark){body{color:#eee;background:#111}}</style></head>
<body><nav><a href="?lang=${other.code}">${other.label}</a></nav><h1>${esc(page.title)}</h1><p>${esc(page.intro)}</p>${sections}</body></html>`;
}
