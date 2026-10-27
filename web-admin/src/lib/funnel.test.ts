import { describe, expect, it } from 'vitest';
import { funnelRows, hasAppData, type FunnelReport } from './funnel';

const report = (counts: number[]): FunnelReport => ({
  steps: (
    [
      ['app_open', 'app'],
      ['price_shown', 'app'],
      ['order_requested', 'app'],
      ['order_created', 'server'],
    ] as const
  ).map(([step, source], i) => ({ step, source, count: counts[i] })),
  days: [],
});

describe('funnelRows', () => {
  it('eni eng katta bosqichga, o\'tish oldingi bosqichga nisbatan', () => {
    const rows = funnelRows(report([200, 100, 50, 45]));
    expect(rows.map((r) => r.widthPct)).toEqual([100, 50, 25, 23]);
    expect(rows.map((r) => r.fromPrevPct)).toEqual([null, 50, 50, 90]);
  });

  it('oldingi bosqich 0 bo\'lsa o\'tish foizi yo\'q (∞ emas)', () => {
    const rows = funnelRows(report([0, 0, 0, 7]));
    expect(rows.map((r) => r.fromPrevPct)).toEqual([null, null, null, null]);
    expect(rows[3].widthPct).toBe(100);
  });

  it('hammasi 0 — eni 0, bo\'linish xatosi yo\'q', () => {
    expect(funnelRows(report([0, 0, 0, 0])).every((r) => r.widthPct === 0)).toBe(true);
  });

  it('100% dan oshgan o\'tish yashirilmaydi', () => {
    expect(funnelRows(report([10, 10, 4, 6]))[3].fromPrevPct).toBe(150);
  });
});

describe('hasAppData', () => {
  it('faqat server bosqichlari bo\'lsa — ilova ma\'lumoti yo\'q', () => {
    expect(hasAppData(report([0, 0, 0, 9]))).toBe(false);
    expect(hasAppData(report([1, 0, 0, 9]))).toBe(true);
  });
});
