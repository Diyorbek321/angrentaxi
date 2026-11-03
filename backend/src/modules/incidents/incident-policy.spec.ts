import {
  OutcomeContext,
  categoryAllowedFor,
  customerSubjectChoice,
  hasSanctionAgainstSubject,
  isSafetyCategory,
  isUserCategory,
  strikeSuggestion,
  validateOutcomes,
  withinReportWindow,
} from './incident-policy';
import { DEFAULT_INCIDENT_SETTINGS } from '../settings/incident-settings';

describe('incident-policy (INCIDENT-POLICY §3)', () => {
  it('tizim toifalarini foydalanuvchi tanlay olmaydi', () => {
    expect(isUserCategory('rude')).toBe(true);
    expect(isUserCategory('rating_signal')).toBe(false);
    expect(isUserCategory('low_rating')).toBe(false);
    expect(isUserCategory('hack')).toBe(false);
  });

  it('tomonlar bo\'yicha toifalar', () => {
    expect(categoryAllowedFor('driver', 'drunk_passenger')).toBe(true);
    expect(categoryAllowedFor('customer', 'drunk_passenger')).toBe(false);
    expect(categoryAllowedFor('customer', 'detour')).toBe(true);
    expect(categoryAllowedFor('vendor', 'no_show')).toBe(true);
  });

  it('xavfsizlik toifalari', () => {
    expect(isSafetyCategory('harassment')).toBe(true);
    expect(isSafetyCategory('safety')).toBe(true);
    expect(isSafetyCategory('rude')).toBe(false);
  });

  it('mijoz subyekti: toifadan yoki aniq tanlovdan', () => {
    expect(customerSubjectChoice('cold_food')).toBe('vendor');
    expect(customerSubjectChoice('rude')).toBe('courier');
    expect(customerSubjectChoice('rude', 'vendor')).toBe('vendor');
  });

  it('7 kunlik muddat', () => {
    const now = new Date('2026-11-10T00:00:00Z');
    expect(withinReportWindow(new Date('2026-11-04T00:00:00Z'), now, 7)).toBe(true);
    expect(withinReportWindow(new Date('2026-11-02T00:00:00Z'), now, 7)).toBe(false);
    expect(withinReportWindow(null, now, 7)).toBe(false);
  });

  it('zinapoya: 1 → ogohlantirish, 3 → to\'xtatish, 5 → admin', () => {
    const s = DEFAULT_INCIDENT_SETTINGS;
    expect(strikeSuggestion(0, s)).toBe('none');
    expect(strikeSuggestion(1, s)).toBe('warning');
    expect(strikeSuggestion(2, s)).toBe('warning');
    expect(strikeSuggestion(3, s)).toBe('suspension');
    expect(strikeSuggestion(5, s)).toBe('escalate_block');
  });

  describe('validateOutcomes', () => {
    const ctx: OutcomeContext = {
      isAdmin: false,
      canMoveMoney: true,
      subjectRole: 'driver',
      hasSubject: true,
      hasCustomer: true,
      hasDriver: true,
      vertical: 'taxi',
      amountLimit: 100_000,
      maxSuspensionDays: 90,
    };
    const codes = (o: Parameters<typeof validateOutcomes>[0], c: Partial<OutcomeContext> = {}) =>
      validateOutcomes(o, { ...ctx, ...c }).map((p) => p.code);

    it('to\'g\'ri to\'plam', () => {
      expect(codes([{ type: 'warning' }, { type: 'refund', amount: 5000, refundMethod: 'wallet' }])).toEqual([]);
    });
    it('blok — faqat admin', () => {
      expect(codes([{ type: 'block' }])).toEqual(['block_admin_only']);
      expect(codes([{ type: 'block' }], { isAdmin: true })).toEqual([]);
    });
    it('menejer chegarasi va ruxsati', () => {
      expect(codes([{ type: 'compensation', amount: 200_000 }])).toEqual(['amount_limit']);
      expect(codes([{ type: 'penalty', amount: 1000 }], { canMoveMoney: false })).toEqual(['money_permission']);
      expect(codes([{ type: 'refund', amount: 0 }])).toEqual(['amount_invalid']);
    });
    it('harakatsiz yolg\'iz, takror yo\'q', () => {
      expect(codes([{ type: 'no_action' }, { type: 'warning' }])).toContain('no_action_alone');
      expect(codes([{ type: 'warning' }, { type: 'warning' }])).toContain('duplicate');
    });
    it('to\'xtatish: rol va kun', () => {
      expect(codes([{ type: 'suspension', days: 3 }], { subjectRole: 'vendor' })).toEqual(['suspension_role']);
      expect(codes([{ type: 'suspension', days: 0 }])).toEqual(['suspension_days']);
    });
    it('kartaga qaytarish faqat ovqat/market', () => {
      expect(codes([{ type: 'refund', amount: 100, refundMethod: 'card' }])).toEqual(['card_refund_vertical']);
      expect(codes([{ type: 'refund', amount: 100, refundMethod: 'card' }], { vertical: 'food' })).toEqual([]);
    });
  });

  it('subyektga qarshi natija', () => {
    expect(hasSanctionAgainstSubject([{ type: 'refund' }])).toBe(false);
    expect(hasSanctionAgainstSubject([{ type: 'warning' }])).toBe(true);
  });
});
