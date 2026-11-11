import type { NextRequest } from 'next/server';
import { LOCALE_COOKIE, parseLocale } from '@/lib/i18n/core';
import { ru, uz } from '@/locales';

/**
 * Route handler'lar foydalanuvchiga qaytaradigan xato matnlari — so'rov
 * cookie'sidagi tilda. Modul darajasidagi faol tilga tayanmaydi: serverda
 * bir vaqtda turli tildagi so'rovlar bo'lishi mumkin.
 */
export function routeMessages(req: Pick<NextRequest, 'cookies'>): typeof uz.apiRoutes {
  const locale = parseLocale(req.cookies.get(LOCALE_COOKIE)?.value);
  return (locale === 'ru' ? ru : uz).apiRoutes;
}
