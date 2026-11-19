import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { DELETE_ACCOUNT_HTML, PRIVACY_HTML, TERMS_HTML } from './legal.pages';

// Public, unauthenticated HTML pages for store listings:
//   /api/v1/legal/privacy         — App Store "Privacy Policy URL"
//   /api/v1/legal/terms
//   /api/v1/legal/delete-account  — Google Play "Delete account URL"
// @Res() bypasses the global JSON ResponseInterceptor so raw HTML is sent.
@ApiExcludeController()
@Controller('legal')
export class LegalController {
  @Get('privacy')
  privacy(@Res() res: Response): void {
    this.send(res, PRIVACY_HTML);
  }

  @Get('terms')
  terms(@Res() res: Response): void {
    this.send(res, TERMS_HTML);
  }

  @Get('delete-account')
  deleteAccount(@Res() res: Response): void {
    this.send(res, DELETE_ACCOUNT_HTML);
  }

  private send(res: Response, html: string): void {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.type('html').send(html);
  }
}
