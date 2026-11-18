// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, parseLocale, setActiveLocale, type Locale } from './core';

/**
 * Server komponentlar uchun: cookie'dagi tilni o'qiydi va faol til qilib
 * qo'yadi (server tomonda `t()` ham to'g'ri ishlashi uchun).
 */
export function getServerLocale(): Locale {
  const locale = parseLocale(cookies().get(LOCALE_COOKIE)?.value);
  setActiveLocale(locale);
  return locale;
}
