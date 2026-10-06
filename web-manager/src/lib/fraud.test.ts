import { describe, expect, it } from 'vitest';
import { SIGNAL_LABEL, sortSignals } from './fraud';

describe('fraud signals', () => {
  it('kuchli belgilar birinchi', () => {
    expect(sortSignals(['too_short', 'same_device', 'driver_at_pickup'])[0]).toBe('same_device');
  });

  it('har bir belgining izohi bor', () => {
    for (const s of ['same_device', 'repeated_pair', 'new_passenger_one_driver', 'driver_at_pickup', 'too_short'] as const) {
      expect(SIGNAL_LABEL[s].title).toBeTruthy();
    }
  });
});
