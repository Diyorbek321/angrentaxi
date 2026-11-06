import { describe, expect, it } from 'vitest';
import { auditChanges, auditRangeParams, mergeHistory } from './audit-diff';

describe('auditChanges', () => {
  it("ruxsatlar: qo'shilgan va olib tashlangan alohida", () => {
    const changes = auditChanges('staff.permissions_update', {
      before: ['dispatch'],
      after: ['withdrawals_view'],
      added: ['withdrawals_view'],
      removed: ['dispatch'],
    });
    expect(changes).toEqual({ kind: 'permissions', added: ['withdrawals_view'], removed: ['dispatch'] });
  });

  it("before/after obyektlari — faqat o'zgargan maydonlar", () => {
    const changes = auditChanges('intercity_route.update', {
      before: { price: 50000, active: true, name: 'Angren—Toshkent' },
      after: { price: 55000, active: true, name: 'Angren—Toshkent' },
    });
    expect(changes).toEqual({ kind: 'fields', fields: [{ field: 'price', before: '50000', after: '55000' }] });
  });

  it("before yoki after yo'q bo'lsa — null", () => {
    expect(auditChanges('user.block', { role: 'driver' })).toBeNull();
    expect(auditChanges('user.block', null)).toBeNull();
  });

  it("massiv va null qiymatlar o'qiladigan matnga aylanadi", () => {
    const changes = auditChanges('x', { before: { tags: ['a'], note: null }, after: { tags: ['a', 'b'], note: 'ok' } });
    expect(changes).toEqual({
      kind: 'fields',
      fields: [
        { field: 'tags', before: 'a', after: 'a, b' },
        { field: 'note', before: '—', after: 'ok' },
      ],
    });
  });
});

describe('auditRangeParams', () => {
  it("kun chegaralari Toshkent vaqtida, ikkala kun ham kiradi", () => {
    expect(auditRangeParams('2026-10-01', '2026-10-28')).toEqual({
      from: '2026-10-01T00:00:00+05:00',
      to: '2026-10-28T23:59:59.999+05:00',
    });
  });

  it("bo'sh qiymatlar yuborilmaydi", () => {
    expect(auditRangeParams(null, null)).toEqual({});
    expect(auditRangeParams('2026-10-01', null)).toEqual({ from: '2026-10-01T00:00:00+05:00' });
  });
});

describe('mergeHistory', () => {
  const e = (id: string, createdAt: string) => ({ id, createdAt });

  it('takrorsiz, yangisi birinchi, limit bilan', () => {
    const merged = mergeHistory(
      [
        [e('a', '2026-10-01T10:00:00Z'), e('b', '2026-10-03T10:00:00Z')],
        [e('c', '2026-10-02T10:00:00Z'), e('b', '2026-10-03T10:00:00Z')],
      ],
      2,
    );
    expect(merged.map((x) => x.id)).toEqual(['b', 'c']);
  });
});
