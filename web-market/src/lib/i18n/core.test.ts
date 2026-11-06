// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  createTranslator,
  getLocale,
  intlLocale,
  parseLocale,
  setActiveLocale,
} from './core';
import { kitT } from './kit-messages';

afterEach(() => setActiveLocale(DEFAULT_LOCALE));

describe('parseLocale', () => {
  it('accepts the supported locales', () => {
    expect(parseLocale('uz')).toBe('uz');
    expect(parseLocale('ru')).toBe('ru');
  });

  it('falls back to Uzbek for anything else', () => {
    expect(parseLocale(undefined)).toBe('uz');
    expect(parseLocale(null)).toBe('uz');
    expect(parseLocale('')).toBe('uz');
    expect(parseLocale('en')).toBe('uz');
    expect(parseLocale('RU')).toBe('uz');
  });
});

describe('intlLocale', () => {
  it('maps to BCP-47 tags', () => {
    expect(intlLocale('uz')).toBe('uz-UZ');
    expect(intlLocale('ru')).toBe('ru-RU');
  });

  it('defaults to the active locale', () => {
    expect(intlLocale()).toBe('uz-UZ');
    setActiveLocale('ru');
    expect(intlLocale()).toBe('ru-RU');
  });
});

describe('createTranslator', () => {
  const t = createTranslator({
    uz: { hello: 'Salom', count: (n: number) => `${n} ta` },
    ru: { hello: 'Привет', count: (n: number) => `${n} шт.` },
  });

  it('starts in Uzbek', () => {
    expect(getLocale()).toBe('uz');
    expect(t().hello).toBe('Salom');
    expect(t().count(3)).toBe('3 ta');
  });

  it('follows the active locale on every call', () => {
    setActiveLocale('ru');
    expect(t().hello).toBe('Привет');
    expect(t().count(3)).toBe('3 шт.');
    setActiveLocale('uz');
    expect(t().hello).toBe('Salom');
  });
});

describe('kit messages', () => {
  it('has Russian text for the shared kit', () => {
    expect(kitT().confirm.ok).toBe('Tasdiqlash');
    expect(kitT().dataTable.selected(3)).toBe('3 ta tanlandi');
    setActiveLocale('ru');
    expect(kitT().confirm.ok).toBe('Подтвердить');
    expect(kitT().common.cancel).toBe('Отмена');
    expect(kitT().format.currency).toBe('сум');
  });
});
