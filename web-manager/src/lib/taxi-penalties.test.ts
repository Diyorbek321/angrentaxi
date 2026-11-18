import { describe, expect, it } from 'vitest';
import { canInterrupt, penaltiesApply, taxiOutcome } from './taxi-penalties';

describe('taksi jarimalari va uzilish (INCIDENT-POLICY §5)', () => {
  it('uzish — faqat boshlangan taksi/yuk safari', () => {
    expect(canInterrupt({ status: 'in_progress', serviceType: 'taxi', driverId: 'd' })).toBe(true);
    expect(canInterrupt({ status: 'in_progress', serviceType: 'cargo', driverId: 'd' })).toBe(true);
    expect(canInterrupt({ status: 'arrived', serviceType: 'taxi', driverId: 'd' })).toBe(false);
    expect(canInterrupt({ status: 'in_progress', serviceType: 'food', driverId: 'd' })).toBe(false);
    expect(canInterrupt({ status: 'in_progress', serviceType: 'taxi', driverId: null })).toBe(false);
    expect(penaltiesApply({ serviceType: 'taxi', intercityTripId: 't1' })).toBe(false);
  });

  it('natija kartasi', () => {
    expect(taxiOutcome({ status: 'completed', tripOutcome: 'interrupted', interruptReason: 'accident' })).toEqual({
      kind: 'interrupted',
      reason: 'accident',
    });
    expect(taxiOutcome({ status: 'cancelled', cancelReason: 'no_show', cancellationFee: 5000 })).toEqual({
      kind: 'no_show',
      fee: 5000,
    });
    expect(taxiOutcome({ status: 'cancelled', cancellationFee: 3000 })).toEqual({ kind: 'late_cancel', fee: 3000 });
    expect(taxiOutcome({ status: 'cancelled', cancellationFee: null })).toBeNull();
    expect(taxiOutcome({ status: 'completed' })).toBeNull();
  });
});
