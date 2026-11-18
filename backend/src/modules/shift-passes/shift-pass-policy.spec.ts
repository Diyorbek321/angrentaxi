import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  assertCanBuyShiftPass,
  compareShiftPassWithCommission,
  effectiveShiftPassStatus,
  shiftPassCovers,
  shiftPassWindow,
} from './shift-pass-policy';

describe('shift-pass-policy', () => {
  const start = new Date('2026-10-15T06:00:00Z');
  const end = new Date('2026-10-16T06:00:00Z');
  const pass = { startsAt: start, endsAt: end, status: 'active' as const, serviceTypes: ['taxi'] };

  describe('shiftPassWindow', () => {
    it('hozirdan boshlab N soat', () => {
      expect(shiftPassWindow(start, 24)).toEqual({ startsAt: start, endsAt: end });
    });
  });

  describe('shiftPassCovers', () => {
    it('oyna ichida va xizmat turi mos — qamraydi', () => {
      expect(shiftPassCovers(pass, 'taxi', new Date('2026-10-15T20:00:00Z'))).toBe(true);
      expect(shiftPassCovers(pass, 'taxi', start)).toBe(true);
    });

    it('tugash payti — endi qamramaydi (yarim ochiq oraliq)', () => {
      expect(shiftPassCovers(pass, 'taxi', end)).toBe(false);
    });

    it('boshqa xizmat turi — qamramaydi', () => {
      expect(shiftPassCovers(pass, 'food', new Date('2026-10-15T20:00:00Z'))).toBe(false);
    });

    it('bekor qilingan smena — qamramaydi', () => {
      expect(shiftPassCovers({ ...pass, status: 'cancelled' }, 'taxi', new Date('2026-10-15T20:00:00Z'))).toBe(false);
    });
  });

  describe('effectiveShiftPassStatus', () => {
    it('muddati o‘tgan faol smena — expired', () => {
      expect(effectiveShiftPassStatus(pass, end)).toBe('expired');
      expect(effectiveShiftPassStatus(pass, start)).toBe('active');
      expect(effectiveShiftPassStatus({ ...pass, status: 'cancelled' }, start)).toBe('cancelled');
    });
  });

  describe('assertCanBuyShiftPass', () => {
    const ok = { enabled: true, price: 25000, balance: 30000, hasActivePass: false };

    it('hammasi joyida — xato yo‘q', () => {
      expect(() => assertCanBuyShiftPass(ok)).not.toThrow();
    });

    it('o‘chiq — 400', () => {
      expect(() => assertCanBuyShiftPass({ ...ok, enabled: false })).toThrow(BadRequestException);
    });

    it('faol smena bor — 409, ustma-ust tushmaydi', () => {
      expect(() => assertCanBuyShiftPass({ ...ok, hasActivePass: true })).toThrow(ConflictException);
    });

    it('balans yetmaydi — o‘zbekcha xabar bilan 400', () => {
      expect(() => assertCanBuyShiftPass({ ...ok, balance: 24999 })).toThrow(/Hamyonda mablag' yetarli emas/);
    });

    it('mashina o‘qiydigan kodlar (SHIFT_PASS_*)', () => {
      const codeOf = (input: typeof ok) => {
        try {
          assertCanBuyShiftPass(input);
        } catch (e) {
          return (e as { getResponse(): Record<string, unknown> }).getResponse();
        }
        return null;
      };
      expect(codeOf({ ...ok, enabled: false })).toEqual(expect.objectContaining({ code: 'SHIFT_PASS_DISABLED' }));
      expect(codeOf({ ...ok, hasActivePass: true })).toEqual(expect.objectContaining({ code: 'SHIFT_PASS_ACTIVE' }));
      expect(codeOf({ ...ok, balance: 24999 })).toEqual(
        expect.objectContaining({
          code: 'SHIFT_PASS_INSUFFICIENT_BALANCE',
          details: { price: 25000, balance: 24999 },
        }),
      );
    });
  });

  describe('compareShiftPassWithCommission', () => {
    it('komissiya qimmatroq — smena tavsiya qilinadi', () => {
      expect(
        compareShiftPassWithCommission({ periodDays: 7, commissionPaid: 120000, workingDays: 4, passPrice: 25000 }),
      ).toEqual({
        periodDays: 7,
        commissionPaid: 120000,
        workingDays: 4,
        passCost: 100000,
        cheaperOption: 'shift_pass',
        savings: 20000,
      });
    });

    it('smena qimmatroq — komissiya tavsiya qilinadi', () => {
      expect(
        compareShiftPassWithCommission({ periodDays: 7, commissionPaid: 30000, workingDays: 3, passPrice: 25000 }),
      ).toMatchObject({ passCost: 75000, cheaperOption: 'commission', savings: 45000 });
    });

    it('teng yoki ish yo‘q — equal', () => {
      expect(
        compareShiftPassWithCommission({ periodDays: 7, commissionPaid: 0, workingDays: 0, passPrice: 25000 }),
      ).toMatchObject({ passCost: 0, cheaperOption: 'equal', savings: 0 });
    });
  });
});
