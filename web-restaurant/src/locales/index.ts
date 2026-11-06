import { createTranslator, type Locale } from '@/lib/i18n/core';
import { uz, type Messages } from './uz';
import { ru } from './ru';

export type { Messages };

const MESSAGES: Record<Locale, Messages> = { uz, ru };

/**
 * Faol til lug'ati. Render paytida (komponent yoki lib funksiyasi ichida)
 * chaqiring — modul darajasida EMAS, aks holda matn o'zbekchada qotib qoladi.
 */
export const t = createTranslator<Messages>(MESSAGES);

/**
 * Aniq til lug'ati — server route handler'lar uchun: u yerda modul darajasidagi
 * "faol til" parallel so'rovlar orasida bo'linadi, shuning uchun tilni
 * so'rov cookie'sidan o'qib, to'g'ridan-to'g'ri olamiz.
 */
export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}
