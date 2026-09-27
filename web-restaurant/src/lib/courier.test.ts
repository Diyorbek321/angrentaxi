import { describe, expect, it } from 'vitest';
import { courierState } from './courier';

const ride = (status: string) => ({ orderId: 'r1', status, driverName: null, driverPhone: null });

describe('courierState', () => {
  it('offers a re-dispatch when the ride found nobody', () => {
    expect(courierState(ride('cancelled'))).toEqual({
      tone: 'failed',
      label: 'Kuryer topilmadi',
      canRedispatch: true,
    });
  });

  it('offers a re-dispatch when no ride was ever created', () => {
    expect(courierState(null).canRedispatch).toBe(true);
  });

  it.each(['created', 'searching', 'accepted', 'arrived', 'in_progress', 'completed'])(
    'never offers a second courier while the ride is %s',
    (status) => {
      expect(courierState(ride(status)).canRedispatch).toBe(false);
    },
  );

  it('marks an assigned courier as active', () => {
    expect(courierState(ride('in_progress')).tone).toBe('active');
  });
});
