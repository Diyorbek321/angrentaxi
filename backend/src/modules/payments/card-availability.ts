/**
 * Karta to'lovi mavjudmi — YAGONA manba (docs/INCIDENT-POLICY.md §1).
 *
 * Provayderlar (`payme/click/uzcard.provider.ts`) `isConfigured()` ni shu
 * funksiyalar orqali beradi; `SettingsService.cardPaymentsAvailable()` esa
 * provayder klasslarini import qilmasdan (modul aylanasi bo'lmasin) xuddi
 * shu tekshiruvni ishlatadi. Kalit qo'shilsa/o'zgarsa — faqat shu fayl.
 */
export interface ConfigReader {
  get<T = string>(key: string, defaultValue?: T): T | undefined;
}

function has(config: ConfigReader, ...keys: string[]): boolean {
  return keys.every((key) => Boolean(config.get<string>(key, '')));
}

/** Payme merchant kalitlari. */
export function paymeConfigured(config: ConfigReader): boolean {
  return has(config, 'PAYME_MERCHANT_ID', 'PAYME_SECRET_KEY');
}

/** Click — uchala kalit kerak. */
export function clickConfigured(config: ConfigReader): boolean {
  return has(config, 'CLICK_MERCHANT_ID', 'CLICK_SECRET_KEY', 'CLICK_SERVICE_ID');
}

/** Uzcard terminal va imzo kaliti (dev mock hisobga olinmaydi). */
export function uzcardConfigured(config: ConfigReader): boolean {
  return has(config, 'UZCARD_TERMINAL_ID', 'UZCARD_SECRET_KEY');
}

export type CardPaymentProvider = 'payme' | 'click' | 'uzcard';

/** Sozlangan provayderlar — ilova checkout'ni shulardan biri bilan ochadi. */
export function configuredCardProviders(config: ConfigReader): CardPaymentProvider[] {
  return [
    ...(paymeConfigured(config) ? (['payme'] as const) : []),
    ...(clickConfigured(config) ? (['click'] as const) : []),
    ...(uzcardConfigured(config) ? (['uzcard'] as const) : []),
  ];
}

/** Kamida bitta provayder sozlangan bo'lsa — karta bilan to'lash mumkin. */
export function cardPaymentsConfigured(config: ConfigReader): boolean {
  return configuredCardProviders(config).length > 0;
}
