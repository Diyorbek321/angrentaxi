import { createTranslator } from '@/lib/i18n/core';
import { uz, type Messages } from './uz';
import { ru } from './ru';

/** `const m = t();` — render paytida chaqiring, modul darajasida emas. */
export const t = createTranslator<Messages>({ uz, ru });

export type { Messages };
