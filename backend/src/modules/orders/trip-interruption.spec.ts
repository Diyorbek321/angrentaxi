import { FareBreakdown } from '../tariffs/fare-breakdown';
import { capInterruptedFare, straightLineKm } from './trip-interruption';

const fare = (total: number) => ({ total } as FareBreakdown);

describe('trip-interruption (INCIDENT-POLICY §5)', () => {
  it("uzilgan safar qat'iy narxdan qimmat bo'lmaydi", () => {
    expect(capInterruptedFare(fare(30_000), fare(20_000), true).total).toBe(20_000);
    expect(capInterruptedFare(fare(8_000), fare(20_000), true).total).toBe(8_000);
  });

  it("hisoblagich safarida (qat'iy emas) — chegarasiz", () => {
    expect(capInterruptedFare(fare(30_000), fare(20_000), false).total).toBe(30_000);
    expect(capInterruptedFare(fare(30_000), null, true).total).toBe(30_000);
  });

  it("to'g'ri chiziq masofasi", () => {
    expect(straightLineKm({ lat: 41, lng: 70 }, { lat: 41.01, lng: 70 })).toBeCloseTo(1.11, 2);
    expect(straightLineKm({ lat: 41, lng: 70 }, { lat: 41, lng: 70 })).toBe(0);
  });
});
