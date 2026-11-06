import { createTranslator } from '@/lib/i18n/core';
import { uz, type Messages } from './uz';
import { ru } from './ru';

/**
 * Panel matnlari. Render paytida chaqiring (`const m = t();`), modul
 * darajasida emas — aks holda til almashganda matn o'zbekcha qotib qoladi.
 */
export const t = createTranslator<Messages>({ uz, ru });

export type { Messages };
