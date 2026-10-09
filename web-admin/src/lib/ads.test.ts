import { describe, expect, it } from 'vitest';
import { adCtr, adState, buildAdFormData, dailyTotals, formatCtr, validateAdForm, type AdFormInput } from './ads';

const NOW = new Date('2026-10-06T12:00:00Z');

describe('adState', () => {
  const base = { isActive: true, startsAt: null, endsAt: null };

  it('is live when switched on with no window', () => {
    expect(adState(base, NOW)).toBe('live');
  });

  it('the switch wins over the window', () => {
    expect(adState({ ...base, isActive: false, endsAt: '2027-01-01T00:00:00Z' }, NOW)).toBe('off');
  });

  it('distinguishes scheduled and ended', () => {
    expect(adState({ ...base, startsAt: '2026-10-07T00:00:00Z' }, NOW)).toBe('scheduled');
    expect(adState({ ...base, endsAt: '2026-10-06T12:00:00Z' }, NOW)).toBe('ended');
  });
});

describe('adCtr', () => {
  it('has no rate without impressions', () => {
    expect(adCtr({ impressions: 0, clicks: 0 })).toBeNull();
    expect(formatCtr(null)).toBe('—');
  });

  it('formats small rates with one decimal', () => {
    expect(formatCtr(adCtr({ impressions: 400, clicks: 9 }))).toBe('2.3%');
    expect(formatCtr(adCtr({ impressions: 10, clicks: 3 }))).toBe('30%');
  });
});

const png = new File([new Uint8Array(10)], 'ad.png', { type: 'image/png' });
const valid: AdFormInput = {
  title: 'Lavash',
  linkType: 'none',
  linkTarget: '',
  startsAt: '',
  endsAt: '',
  sortOrder: '0',
  isActive: true,
  image: png,
};

describe('validateAdForm', () => {
  it('accepts a minimal banner', () => {
    expect(validateAdForm(valid)).toEqual({});
  });

  it('requires an image of an allowed type and size', () => {
    expect(validateAdForm({ ...valid, image: null }).image).toBeDefined();
    const gif = new File([new Uint8Array(1)], 'a.gif', { type: 'image/gif' });
    expect(validateAdForm({ ...valid, image: gif }).image).toBeDefined();
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' });
    expect(validateAdForm({ ...valid, image: big }).image).toBeDefined();
  });

  it('only allows https links', () => {
    expect(validateAdForm({ ...valid, linkType: 'url', linkTarget: 'http://a.uz' }).linkTarget).toBeDefined();
    expect(validateAdForm({ ...valid, linkType: 'url', linkTarget: 'https://a.uz/x' })).toEqual({});
  });

  it('needs a vendor for vendor links and an ordered window', () => {
    expect(validateAdForm({ ...valid, linkType: 'store' }).linkTarget).toBeDefined();
    expect(
      validateAdForm({ ...valid, startsAt: '2026-10-10T10:00', endsAt: '2026-10-09T10:00' }).endsAt
    ).toBeDefined();
  });
});

describe('buildAdFormData', () => {
  it('omits the target for an unlinked banner and sends dates as ISO', () => {
    const form = buildAdFormData({ ...valid, linkTarget: 'stray', startsAt: '2026-10-10T10:00' });
    expect(form.get('linkTarget')).toBeNull();
    expect(form.get('startsAt')).toBe(new Date('2026-10-10T10:00').toISOString());
    expect(form.get('isActive')).toBe('true');
    expect(form.get('image')).toBeInstanceOf(File);
  });
});

describe('dailyTotals', () => {
  it('davr bo\'yicha jami va CTR', () => {
    const totals = dailyTotals([
      { day: '2026-10-08', impressions: 300, clicks: 6 },
      { day: '2026-10-09', impressions: 100, clicks: 2 },
    ]);
    expect(totals).toEqual({ impressions: 400, clicks: 8, ctr: 2 });
  });

  it('ko\'rish bo\'lmasa CTR yo\'q', () => {
    expect(dailyTotals([]).ctr).toBeNull();
  });
});
