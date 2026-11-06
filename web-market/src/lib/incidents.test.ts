import { describe, expect, it } from 'vitest';
import { canReportOrder, defaultSubjectFor, reportProblem } from './incidents';

describe('sotuvchi shikoyati (INCIDENT-POLICY §3)', () => {
  const now = new Date('2026-11-10T00:00:00Z');

  it('faqat tugagan buyurtma va 7 kun ichida', () => {
    expect(canReportOrder({ status: 'delivered', updatedAt: '2026-11-05T00:00:00Z' }, now)).toBe(true);
    expect(canReportOrder({ status: 'delivered', updatedAt: '2026-10-30T00:00:00Z' }, now)).toBe(false);
    expect(canReportOrder({ status: 'new', updatedAt: '2026-11-09T00:00:00Z' }, now)).toBe(false);
    expect(canReportOrder({ status: 'returned' }, now)).toBe(true);
  });

  it('subyekt standarti', () => {
    expect(defaultSubjectFor('no_show')).toBe('customer');
    expect(defaultSubjectFor('rude')).toBe('courier');
  });

  it('matn 3–1000 belgi', () => {
    expect(reportProblem({ description: '  a ' })).toBe('description');
    expect(reportProblem({ description: 'Kuryer qo‘pol' })).toBeNull();
  });
});
