// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
/**
 * Panel tili: o'zbekcha (asosiy) va ruscha. Hamma panel shu bitta yadroni
 * ishlatadi; har panelning o'z matnlari `src/locales/{uz,ru}.ts` da.
 *
 * NEGA modul darajasidagi "faol til": matnlar faqat komponentlarda emas,
 * `format.ts` va `lib/*.ts` dagi yorliq funksiyalarida ham kerak. Ularga
 * hook berib bo'lmaydi. Til almashganda `I18nProvider` butun daraxtni qayta
 * o'rnatadi (key={locale}), shuning uchun `t()` ni chaqirgan har joy yangi
 * tilda qayta chiziladi.
 *
 * Tanlov cookie'da (`panel_locale`): server layout uni o'qib, birinchi
 * HTML'ni to'g'ri tilda beradi — localStorage'da bo'lsa, sahifa avval
 * o'zbekcha chiqib, keyin ruschaga sakrardi.
 */

export type Locale = 'uz' | 'ru';

export const LOCALES: readonly Locale[] = ['uz', 'ru'];
export const DEFAULT_LOCALE: Locale = 'uz';
export const LOCALE_COOKIE = 'panel_locale';

/** Til tanlagichdagi yorliqlar — har doim o'z tilida yoziladi. */
export const LOCALE_LABELS: Record<Locale, { short: string; name: string }> = {
  uz: { short: 'UZ', name: 'Oʻzbekcha' },
  ru: { short: 'RU', name: 'Русский' },
};

export function parseLocale(value: string | null | undefined): Locale {
  return value === 'ru' || value === 'uz' ? value : DEFAULT_LOCALE;
}

/** `Intl` / `toLocaleString` uchun BCP-47 teg. */
export function intlLocale(locale: Locale = activeLocale): string {
  return locale === 'ru' ? 'ru-RU' : 'uz-UZ';
}

let activeLocale: Locale = DEFAULT_LOCALE;

export function getLocale(): Locale {
  return activeLocale;
}

/** Faqat `I18nProvider` chaqiradi. */
export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}

/** Til cookie'sini yozadi (1 yil). Barcha panellar bir cookie'ni bo'lishadi. */
export function persistLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Panel lug'atidan `t()` yasaydi. `ru` ning tipi `uz` dan olinadi, shuning
 * uchun ruscha kalit tushib qolsa — TypeScript build'ni to'xtatadi.
 */
export function createTranslator<M>(messages: Record<Locale, M>): () => M {
  return () => messages[activeLocale];
}
