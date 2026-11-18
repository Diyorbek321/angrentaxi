import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';

/** Qisqa kalit — sozlanmagan deb hisoblanadi (taxmin qilib topilmasin). */
export const REPORTS_API_KEY_MIN_LENGTH = 32;

/**
 * Biznes hisobotlari API'si foydalanuvchi sessiyasisiz, `X-Reports-Key`
 * sarlavhasi bilan ochiladi — egasining Claude skill'lari (moliya, operatsiya
 * va h.k.) prod raqamlarini shu orqali o'qiydi. Kalit `REPORTS_API_KEY`
 * da; bo'sh yoki qisqa bo'lsa endpoint butunlay yopiq.
 */
@Injectable()
export class ReportsKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('REPORTS_API_KEY', '');
    const header = context.switchToHttp().getRequest().headers['x-reports-key'];
    const given = typeof header === 'string' ? header : '';
    if (expected.length < REPORTS_API_KEY_MIN_LENGTH || !given || !sameSecret(given, expected)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}

/** Xeshlab solishtiriladi — uzunlik farqi ham sizib chiqmaydi. */
function sameSecret(a: string, b: string): boolean {
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}
