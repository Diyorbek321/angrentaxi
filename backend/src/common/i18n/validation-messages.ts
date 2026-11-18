/**
 * class-validator standart xabarlarining tarjimasi (2026-11-03).
 *
 * NEGA ALOHIDA: `error-catalogue.ts` dagi drift testi har bir manba bizning
 * kodimizda turishini talab qiladi, bu xabarlar esa kutubxonaniki — ularning
 * drift testi `class-validator` ning o'z fayllariga qaraydi.
 *
 * `source` — kutubxona matni: `{0}` = maydon nomi (`$property`), `{1}` =
 * chegara (`$constraint1`/`$constraint2`). Tarjimada `{0}` — tayyor yorliq:
 * `«phone»` yoki `each: true` bo'lsa `«serviceTypes» ning har bir qiymati`.
 * Maydon nomi tarjima qilinmaydi: u kodda ham, mijoz formasida ham bir xil,
 * va xato aynan qaysi maydonda ekanini ko'rsatadi.
 */
import type { AppLanguage } from './error-messages';

export interface ValidationCatalogueEntry {
  source: string;
  uz: string;
  ru: string;
}

export const VALIDATION_CATALOGUE: readonly ValidationCatalogueEntry[] = [
  { source: 'property {0} should not exist', uz: '{0} maydoni qabul qilinmaydi', ru: 'Поле {0} не принимается' },
  { source: '{0} should not be empty', uz: "{0} bo'sh bo'lmasligi kerak", ru: '{0} не может быть пустым' },
  { source: '{0} must be a string', uz: "{0} matn bo'lishi kerak", ru: '{0} должно быть строкой' },
  {
    source: '{0} must be a number conforming to the specified constraints',
    uz: "{0} son bo'lishi kerak",
    ru: '{0} должно быть числом',
  },
  { source: '{0} must be an integer number', uz: "{0} butun son bo'lishi kerak", ru: '{0} должно быть целым числом' },
  { source: '{0} must not be less than {1}', uz: "{0} {1} dan kichik bo'lmasligi kerak", ru: '{0} — не меньше {1}' },
  { source: '{0} must not be greater than {1}', uz: "{0} {1} dan katta bo'lmasligi kerak", ru: '{0} — не больше {1}' },
  {
    source: '{0} must be shorter than or equal to {1} characters',
    uz: "{0} ko'pi bilan {1} belgi bo'lishi kerak",
    ru: '{0} — не более {1} символов',
  },
  {
    source: '{0} must be longer than or equal to {1} characters',
    uz: "{0} kamida {1} belgi bo'lishi kerak",
    ru: '{0} — не менее {1} символов',
  },
  {
    source: '{0} must be one of the following values: {1}',
    uz: "{0} quyidagilardan biri bo'lishi kerak: {1}",
    ru: '{0} должно быть одним из значений: {1}',
  },
  { source: '{0} must be a UUID', uz: "{0} noto'g'ri identifikator", ru: '{0} — неверный идентификатор' },
  { source: '{0} must be a boolean value', uz: "{0} ha/yo'q qiymati bo'lishi kerak", ru: '{0} должно быть да/нет' },
  { source: '{0} must match {1} regular expression', uz: "{0} formati noto'g'ri", ru: '{0} — неверный формат' },
  { source: '{0} must be an array', uz: "{0} ro'yxat bo'lishi kerak", ru: '{0} должно быть списком' },
  { source: '{0} must be an object', uz: "{0} obyekt bo'lishi kerak", ru: '{0} должно быть объектом' },
  {
    source: '{0} must be a valid ISO 8601 date string',
    uz: "{0} sana formati noto'g'ri",
    ru: '{0} — неверный формат даты',
  },
  { source: '{0} must be a Date instance', uz: "{0} sana bo'lishi kerak", ru: '{0} должно быть датой' },
  {
    source: '{0} must contain no more than {1} elements',
    uz: "{0} ko'pi bilan {1} ta bo'lishi kerak",
    ru: '{0} — не более {1} элементов',
  },
  {
    source: '{0} must contain at least {1} elements',
    uz: "{0} kamida {1} ta bo'lishi kerak",
    ru: '{0} — не менее {1} элементов',
  },
  { source: '{0} must be a latitude string or number', uz: "{0} kenglik bo'lishi kerak", ru: '{0} должно быть широтой' },
  { source: '{0} must be a longitude string or number', uz: "{0} uzunlik bo'lishi kerak", ru: '{0} должно быть долготой' },
  { source: '{0} must be a valid phone number', uz: "{0} telefon raqami noto'g'ri", ru: '{0} — неверный номер телефона' },
  { source: '{0} must be an email', uz: "{0} email noto'g'ri", ru: '{0} — неверный email' },
];

const EACH_PREFIX = 'each value in ';

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const COMPILED = VALIDATION_CATALOGUE.map((entry) => ({
  entry,
  pattern: new RegExp(
    `^${entry.source
      .split(/(\{\d\})/)
      .map((part) => (/^\{\d\}$/.test(part) ? '(.+?)' : escapeRegExp(part)))
      .join('')}$`,
    's',
  ),
}));

function fieldLabel(field: string, each: boolean, language: AppLanguage): string {
  const quoted = `«${field}»`;
  if (!each) return quoted;
  return language === 'ru' ? `каждое значение ${quoted}` : `${quoted} ning har bir qiymati`;
}

/**
 * Bitta class-validator xabarini tilga o'giradi. Lug'atda yo'q bo'lsa
 * (masalan DTO'dagi o'zimizning `message`) — o'zgarmay qaytadi.
 */
export function localizeValidationMessage(message: string, language: AppLanguage): string {
  const each = message.startsWith(EACH_PREFIX);
  const body = each ? message.slice(EACH_PREFIX.length) : message;

  for (const { entry, pattern } of COMPILED) {
    const match = pattern.exec(body);
    if (!match) continue;
    const [, field, constraint = ''] = match;
    const template = language === 'ru' ? entry.ru : entry.uz;
    return template.replace('{0}', fieldLabel(field, each, language)).replace('{1}', constraint);
  }
  return message;
}
