// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { afterEach, describe, expect, it } from 'vitest';
import { setActiveLocale } from '@/lib/i18n/core';
import {
  EMPTY,
  formatClock,
  formatCountdown,
  formatDate,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatMoneyApprox,
  formatNumber,
  formatOverdue,
  formatPercent,
  formatPhone,
  formatPrepTimer,
  formatRelative,
  formatTime,
  fullName,
  groupDigits,
  humanizeDuration,
  initials,
  nameFallback,
  PREP_STALE_AFTER_MS,
  shortId,
} from './format';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('money and numbers', () => {
  it('groups digits with spaces', () => {
    expect(groupDigits(1234567)).toBe('1 234 567');
    expect(groupDigits(-43500)).toBe('-43 500');
    expect(groupDigits(-0.2)).toBe('0');
  });

  it('formats money in soʻm', () => {
    expect(formatMoney(43500)).toBe('43 500 soʻm');
    expect(formatMoney('125000.00')).toBe('125 000 soʻm');
    expect(formatMoney(0)).toBe('0 soʻm');
    expect(formatMoney(1500, { currency: false })).toBe('1 500');
    expect(formatMoney(1500, { signed: true })).toBe('+1 500 soʻm');
    expect(formatMoneyApprox(9000)).toBe('~9 000 soʻm');
  });

  it('returns an em dash for missing money', () => {
    expect(formatMoney(null)).toBe(EMPTY);
    expect(formatMoney(undefined)).toBe(EMPTY);
    expect(formatMoney(Number.NaN)).toBe(EMPTY);
    expect(formatMoney('abc')).toBe(EMPTY);
    expect(formatMoneyApprox(null)).toBe(EMPTY);
  });

  it('formats numbers and percents', () => {
    expect(formatNumber(68)).toBe('68');
    expect(formatNumber(12345.678, 2)).toBe('12 345.68');
    expect(formatNumber(null)).toBe(EMPTY);
    expect(formatPercent(12.5)).toBe('12.5%');
    expect(formatPercent(0.25, { ratio: true })).toBe('25%');
    expect(formatPercent(undefined)).toBe(EMPTY);
  });
});

describe('dates', () => {
  const d = new Date(2026, 6, 31, 14, 32);

  it('formats time, date and date-time', () => {
    expect(formatTime(d)).toBe('14:32');
    expect(formatDate(d)).toMatch(/^31 \S+ 2026$/);
    expect(formatDateTime(d)).toMatch(/^31 \S+, 14:32$/);
    expect(formatDateTime(d, { withYear: true })).toMatch(/2026, 14:32$/);
  });

  it('returns an em dash for missing or invalid dates', () => {
    expect(formatTime(null)).toBe(EMPTY);
    expect(formatDate('not-a-date')).toBe(EMPTY);
    expect(formatDateTime(undefined)).toBe(EMPTY);
    expect(formatRelative('')).toBe(EMPTY);
  });

  it('formats relative time with a suffix', () => {
    expect(formatRelative(Date.now() - 5 * MIN)).not.toBe(EMPTY);
  });
});

describe('durations', () => {
  it('humanizes to the two largest units', () => {
    expect(humanizeDuration(2 * DAY + 3 * HOUR + 10 * MIN)).toBe('2 kun 3 soat');
    expect(humanizeDuration(HOUR + 5 * MIN)).toBe('1 soat 5 daq');
    expect(humanizeDuration(4 * MIN + 10_000)).toBe('4 daq 10 son');
    expect(humanizeDuration(12_000)).toBe('12 son');
    expect(humanizeDuration(3 * DAY)).toBe('3 kun');
  });

  it('never renders a negative duration', () => {
    expect(formatDuration(-5000)).toBe(EMPTY);
    expect(formatDuration(-(2 * DAY + 3 * HOUR), { overdue: true })).toBe('2 kun 3 soat kechikdi');
    expect(formatDuration(null)).toBe(EMPTY);
    expect(formatDuration(90 * MIN)).toBe('1 soat 30 daq');
  });

  it('formats overdue and countdowns without hh:mm overflow', () => {
    expect(formatOverdue(2 * DAY + 3 * HOUR)).toBe('2 kun 3 soat kechikdi');
    expect(formatCountdown(65_000)).toBe('01:05');
    expect(formatCountdown(HOUR + 2 * MIN + 3000)).toBe('1:02:03');
    expect(formatCountdown(2 * DAY + HOUR)).toBe('2 kun 1 soat');
    // The bug this replaces: -126597:46.
    const overdue = formatCountdown(-(126597 * MIN + 46_000));
    expect(overdue).toBe('87 kun 21 soat kechikdi');
    expect(overdue).not.toMatch(/^-/);
    expect(formatCountdown(undefined)).toBe(EMPTY);
  });

  it('formats live clocks as m:ss, never raw seconds', () => {
    expect(formatClock(42_000)).toBe('0:42');
    expect(formatClock(60_000)).toBe('1:00');
    expect(formatClock(12 * MIN + 5000)).toBe('12:05');
    expect(formatClock(HOUR + 2 * MIN + 3000)).toBe('1:02:03');
    expect(formatClock(-1)).toBe(EMPTY);
    expect(formatClock(null)).toBe(EMPTY);
  });
});

describe('identity', () => {
  it('formats Uzbek phones', () => {
    expect(formatPhone('+998901234569')).toBe('+998 90 123 45 69');
    expect(formatPhone('901234569')).toBe('+998 90 123 45 69');
    expect(formatPhone('12345')).toBe('12345');
    expect(formatPhone(null)).toBe(EMPTY);
  });

  it('shortens ids', () => {
    expect(shortId('28687CAB-def0-4a1b-9c2d-ffffff000000')).toBe('#28687c');
    expect(shortId('a1b2c3d4-0000-0000-0000-000000000000')).toBe('#a1b2c3');
    expect(shortId(null)).toBe(EMPTY);
  });

  it('joins names null-safely', () => {
    expect(fullName('Ali', 'Valiyev')).toBe('Ali Valiyev');
    expect(fullName('Ali', null)).toBe('Ali');
    expect(fullName(null, 'Valiyev')).toBe('Valiyev');
    expect(fullName(null, null)).toBe('Ism kiritilmagan');
    expect(fullName('null', 'undefined')).toBe('Ism kiritilmagan');
    expect(fullName('  ', undefined, '—')).toBe('—');
  });

  it('builds initials without ever inventing letters', () => {
    expect(initials('Ali Valiyev')).toBe('AV');
    expect(initials('Ali', 'Valiyev')).toBe('AV');
    expect(initials('ali')).toBe('A');
    expect(initials(null, null)).toBe('');
    expect(initials(null)).toBe('');
    expect(initials('null null')).toBe('');
  });
});

describe('formatPrepTimer (kitchen timer)', () => {
  const T0 = Date.parse('2026-10-15T10:00:00Z');
  const order = (status: string, createdAt: number, prep: number[] = [15]) => ({
    status,
    createdAt: new Date(createdAt).toISOString(),
    items: prep.map((prepMinutes) => ({ prepMinutes })),
  });

  it('returns null outside the kitchen states', () => {
    expect(formatPrepTimer(order('ready', T0), T0)).toBeNull();
    expect(formatPrepTimer(order('delivered', T0), T0)).toBeNull();
  });

  it('counts down the longest dish prep time as mm:ss', () => {
    const t = formatPrepTimer(order('new', T0, [5, 15]), T0 + 2 * MIN + 30_000);
    expect(t).toMatchObject({ state: 'ok', text: '12:30' });
  });

  it('flags the last five minutes as "soon"', () => {
    expect(formatPrepTimer(order('preparing', T0), T0 + 11 * MIN)?.state).toBe('soon');
  });

  it('reads overdue time humanly, never as a negative clock', () => {
    const t = formatPrepTimer(order('preparing', T0), T0 + 15 * MIN + (2 * 60 + 15) * MIN);
    expect(t).toMatchObject({ state: 'late', text: 'Kechikmoqda · 2 soat 15 daq' });
    expect(t?.text).not.toMatch(/-\d/);
  });

  it('shows the placed date for absurdly old orders (> 24h)', () => {
    const t = formatPrepTimer(order('new', T0), T0 + PREP_STALE_AFTER_MS + MIN);
    expect(t?.state).toBe('stale');
    expect(t?.text).not.toMatch(/kechik|-|:\d\d:\d\d/i);
    expect(t?.text).toMatch(/\d{2}:\d{2}/);
  });

  it('survives an order with no items', () => {
    expect(formatPrepTimer(order('new', T0, []), T0)).toMatchObject({ state: 'soon', text: '01:00' });
  });
});

describe('Russian locale', () => {
  const T0 = Date.parse('2026-10-15T10:00:00Z');
  const order = (status: string, createdAt: number, prep: number[] = [15]) => ({
    status,
    createdAt: new Date(createdAt).toISOString(),
    items: prep.map((prepMinutes) => ({ prepMinutes })),
  });

  afterEach(() => setActiveLocale('uz'));

  it('formats money in сум', () => {
    setActiveLocale('ru');
    expect(formatMoney(43500)).toBe('43 500 сум');
    expect(formatMoney(1500, { signed: true })).toBe('+1 500 сум');
    expect(formatMoney(1500, { currency: false })).toBe('1 500');
    expect(formatMoneyApprox(9000)).toBe('~9 000 сум');
    expect(formatMoney(null)).toBe(EMPTY);
  });

  it('formats dates with Russian month names', () => {
    setActiveLocale('ru');
    const d = new Date(2026, 6, 31, 14, 32);
    expect(formatDate(d)).toBe('31 июля 2026');
    expect(formatTime(d)).toBe('14:32');
    expect(formatDateTime(d)).toMatch(/^31 июл\S*, 14:32$/);
    expect(formatRelative(Date.now() - 5 * MIN)).toBe('5 минут назад');
  });

  it('humanizes durations with Russian units', () => {
    setActiveLocale('ru');
    expect(humanizeDuration(2 * DAY + 3 * HOUR + 10 * MIN)).toBe('2 д 3 ч');
    expect(humanizeDuration(HOUR + 5 * MIN)).toBe('1 ч 5 мин');
    expect(humanizeDuration(4 * MIN + 10_000)).toBe('4 мин 10 с');
    expect(humanizeDuration(12_000)).toBe('12 с');
    expect(formatCountdown(2 * DAY + HOUR)).toBe('2 д 1 ч');
  });

  it('reads overdue time as "просрочено на …"', () => {
    setActiveLocale('ru');
    expect(formatOverdue(2 * DAY + 3 * HOUR)).toBe('просрочено на 2 д 3 ч');
    expect(formatDuration(-(2 * DAY + 3 * HOUR), { overdue: true })).toBe('просрочено на 2 д 3 ч');
    expect(formatCountdown(-(126597 * MIN + 46_000))).toBe('просрочено на 87 д 21 ч');
  });

  it('localizes the kitchen timer', () => {
    setActiveLocale('ru');
    const late = formatPrepTimer(order('preparing', T0), T0 + 15 * MIN + (2 * 60 + 15) * MIN);
    expect(late).toMatchObject({
      state: 'late',
      text: 'Задержка · 2 ч 15 мин',
      label: 'Приготовление задерживается на 2 ч 15 мин',
    });
    const ok = formatPrepTimer(order('new', T0, [5, 15]), T0 + 2 * MIN + 30_000);
    expect(ok).toMatchObject({ state: 'ok', text: '12:30', label: 'До готовности осталось 12:30' });
    const stale = formatPrepTimer(order('new', T0), T0 + PREP_STALE_AFTER_MS + MIN);
    expect(stale?.label).toMatch(/^Очень старый заказ — поступил /);
  });

  it('uses the Russian name fallback and initials', () => {
    setActiveLocale('ru');
    expect(nameFallback()).toBe('Имя не указано');
    expect(fullName(null, null)).toBe('Имя не указано');
    expect(fullName('  ', undefined, '—')).toBe('—');
    expect(initials('алишер валиев')).toBe('АВ');
  });

  it('switches back to Uzbek byte-for-byte', () => {
    setActiveLocale('ru');
    setActiveLocale('uz');
    expect(formatMoney(43500)).toBe('43 500 soʻm');
    expect(formatOverdue(2 * DAY + 3 * HOUR)).toBe('2 kun 3 soat kechikdi');
    expect(nameFallback()).toBe('Ism kiritilmagan');
  });
});
