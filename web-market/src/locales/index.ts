import { createTranslator } from '@/lib/i18n/core';
import { uz, type Messages } from './uz';
import { ru } from './ru';

/**
 * Panel matnlari: `const m = t();` — render paytida yoki funksiya ichida
 * chaqiring, HECH QACHON modul darajasida (import paytida o'zbekcha qotib qoladi).
 */
export const t = createTranslator<Messages>({ uz, ru });

export type { Messages };
export { uz, ru };
