import type { NextRequest } from 'next/server';
import { LOCALE_COOKIE, parseLocale, type Locale } from '@/lib/i18n/core';
import { messagesFor, type Messages } from '@/locales';

/** So'rov cookie'sidagi panel tili (route handler'lar uchun). */
export function requestLocale(req: NextRequest): Locale {
  return parseLocale(req.cookies.get(LOCALE_COOKIE)?.value);
}

/**
 * Route handler javob matnlari. Modul darajasidagi "faol til" (`t()`) bu yerda
 * ishlatilmaydi — parallel so'rovlar uni bir-birining ustidan yozadi.
 */
export function requestMessages(req: NextRequest): Messages {
  return messagesFor(requestLocale(req));
}
