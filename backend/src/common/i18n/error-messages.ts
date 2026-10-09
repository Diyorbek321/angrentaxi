import { ERROR_CATALOGUE, ErrorCatalogueEntry } from './error-catalogue';

/** Ilova tillari. Standart — o'zbekcha. */
export type AppLanguage = 'uz' | 'ru';

/**
 * `Accept-Language` sarlavhasidan til. Faqat BIRINCHI (eng ustun) til
 * hisobga olinadi: brauzer "en-US,ru;q=0.9" yuborsa — ruscha emas.
 */
export function resolveLanguage(header: string | string[] | undefined): AppLanguage {
  const raw = Array.isArray(header) ? header[0] : header;
  const primary = (raw ?? '').split(',')[0].trim().toLowerCase();
  return primary === 'ru' || primary.startsWith('ru-') ? 'ru' : 'uz';
}

interface CompiledEntry {
  pattern: RegExp;
  entry: ErrorCatalogueEntry;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Doimiy xabarlar — to'g'ridan-to'g'ri qidiruv; o'zgaruvchililar — regex.
const EXACT = new Map<string, ErrorCatalogueEntry>();
const PATTERNS: CompiledEntry[] = [];
for (const entry of ERROR_CATALOGUE) {
  if (!/\{\d\}/.test(entry.source)) {
    EXACT.set(entry.source, entry);
    continue;
  }
  const body = entry.source
    .split(/(\{\d\})/)
    .map((part) => {
      const slot = /^\{(\d)\}$/.exec(part);
      if (!slot) return escapeRegExp(part);
      return '(.+?)';
    })
    .join('');
  PATTERNS.push({ pattern: new RegExp(`^${body}$`, 's'), entry });
}

const fill = (template: string, values: readonly string[]) =>
  template.replace(/\{(\d)\}/g, (_, i: string) => values[Number(i)] ?? '');

/**
 * Xabarni tilga o'giradi. Lug'atda yo'q bo'lsa — o'zgarmay qaytadi.
 * O'zgaruvchilar `{0}`, `{1}` manbadagi tartibda olinadi.
 */
export function localizeMessage(message: string, language: AppLanguage): string {
  const exact = EXACT.get(message);
  if (exact) return pick(exact, language) ?? message;

  for (const { pattern, entry } of PATTERNS) {
    const match = pattern.exec(message);
    if (!match) continue;
    const template = pick(entry, language);
    return template ? fill(template, sourceOrderedValues(entry.source, match)) : message;
  }
  return message;
}

function pick(entry: ErrorCatalogueEntry, language: AppLanguage): string | undefined {
  return language === 'ru' ? entry.ru : entry.uz;
}

/** Regex guruhlarini `{n}` raqamlari bo'yicha joylaydi. */
function sourceOrderedValues(source: string, match: RegExpExecArray): string[] {
  const slots = [...source.matchAll(/\{(\d)\}/g)].map((m) => Number(m[1]));
  const values: string[] = [];
  slots.forEach((slot, i) => {
    values[slot] = match[i + 1];
  });
  return values;
}
