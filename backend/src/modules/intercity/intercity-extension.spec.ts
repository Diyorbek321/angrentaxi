import { IntercityTripClass } from '../../database/entities/intercity-trip.entity';
import {
  ExtensionPoint,
  composeIntercityFare,
  extensionRate,
  kmFromMeters,
  priceExtension,
  zoneOf,
} from './intercity-extension';

// Rohat krugi — egasi bergan koordinata (41°16'04.9"N 69°22'00.5"E).
const ROHAT: ExtensionPoint = {
  name: 'Rohat krugi',
  centerLat: 41.268028,
  centerLng: 69.366806,
  radiusKm: 1.5,
  extensionMaxKm: 30,
  extensionPricePerKm: 2000,
  extensionComfortPricePerKm: 2500,
};

const NO_EXTENSION: ExtensionPoint = { ...ROHAT, extensionMaxKm: 0, extensionPricePerKm: 0, extensionComfortPricePerKm: null };

// ~0.009° kenglik ≈ 1 km.
const kmNorth = (km: number) => ({ lat: ROHAT.centerLat + km * 0.008993, lng: ROHAT.centerLng });

describe('zoneOf', () => {
  it('radius ichida — inside', () => {
    const p = kmNorth(1);
    expect(zoneOf(ROHAT, p.lat, p.lng)).toBe('inside');
  });

  it('radiusdan tashqarida, extensionMaxKm ichida — extension', () => {
    const p = kmNorth(10);
    expect(zoneOf(ROHAT, p.lat, p.lng)).toBe('extension');
  });

  it('extensionMaxKm dan uzoq — outside', () => {
    const p = kmNorth(35);
    expect(zoneOf(ROHAT, p.lat, p.lng)).toBe('outside');
  });

  it('davom o\'chiq nuqtada radiusdan tashqari — outside', () => {
    const p = kmNorth(5);
    expect(zoneOf(NO_EXTENSION, p.lat, p.lng)).toBe('outside');
  });

  it('max km bor, lekin narx 0 — davom yoqilmagan hisoblanadi', () => {
    const p = kmNorth(5);
    expect(zoneOf({ ...ROHAT, extensionPricePerKm: 0 }, p.lat, p.lng)).toBe('outside');
  });
});

describe('extensionRate', () => {
  it('Start — asosiy narx', () => {
    expect(extensionRate(ROHAT, IntercityTripClass.START)).toBe(2000);
  });

  it('Comfort — comfort narxi', () => {
    expect(extensionRate(ROHAT, IntercityTripClass.COMFORT)).toBe(2500);
  });

  it('Comfort narxi berilmagan — Start narxi', () => {
    expect(extensionRate({ ...ROHAT, extensionComfortPricePerKm: null }, IntercityTripClass.COMFORT)).toBe(2000);
  });
});

describe('kmFromMeters', () => {
  it('0.1 km ga yaxlitlaydi', () => {
    expect(kmFromMeters(12_440)).toBe(12.4);
    expect(kmFromMeters(12_450)).toBe(12.5);
    expect(kmFromMeters(0)).toBe(0);
  });
});

describe('priceExtension', () => {
  it('500 so\'mga YUQORIGA yaxlitlaydi: 12.4 km × 2000 = 24 800 → 25 000', () => {
    expect(priceExtension(12.4, 2000)).toBe(25_000);
  });

  it('aniq 500 ga karrali bo\'lsa o\'zgarmaydi', () => {
    expect(priceExtension(1.5, 2000)).toBe(3000);
  });

  it('suzuvchi nuqta xatosi keyingi qadamga sakratmaydi (0.3 × 2500 = 750 → 1000)', () => {
    expect(priceExtension(0.3, 2500)).toBe(1000);
    expect(priceExtension(0.2, 2500)).toBe(500);
  });

  it('0 km yoki 0 narx — 0', () => {
    expect(priceExtension(0, 2000)).toBe(0);
    expect(priceExtension(5, 0)).toBe(0);
  });
});

describe('composeIntercityFare', () => {
  it('davomsiz — jami = asosiy narx, invariant saqlanadi', () => {
    const fare = composeIntercityFare(50_000, [], 60);
    expect(fare.baseFare).toBe(50_000);
    expect(fare.distanceFare).toBe(0);
    expect(fare.total).toBe(50_000);
    expect(fare.intercityExtensions).toEqual([]);
  });

  it('ikki tomon davomi — distanceFare yig\'indi, jami = asosiy + davom', () => {
    const fare = composeIntercityFare(
      25_000,
      [
        { side: 'pickup', pointName: 'Angren', km: 3.2, pricePerKm: 1500, fare: 5000, estimated: false },
        { side: 'dropoff', pointName: 'Rohat krugi', km: 12.4, pricePerKm: 2000, fare: 25_000, estimated: true },
      ],
      70,
    );
    expect(fare.distanceKm).toBe(15.6);
    expect(fare.distanceFare).toBe(30_000);
    // Turli narx — bitta "km narxi" chekda yolg'on bo'lardi.
    expect(fare.pricePerKm).toBe(0);
    expect(fare.total).toBe(55_000);
    expect(
      fare.baseFare +
        fare.distanceFare +
        fare.timeFare +
        fare.minPriceAdjustment +
        fare.surgeFare +
        fare.maxPriceCap +
        (fare.optionsFare ?? 0) +
        fare.waitingFare +
        fare.roundingAdjustment,
    ).toBe(fare.total);
  });

  it('bitta narx bo\'lsa pricePerKm chekda ko\'rinadi', () => {
    const fare = composeIntercityFare(
      25_000,
      [{ side: 'dropoff', pointName: 'Rohat krugi', km: 12.4, pricePerKm: 2000, fare: 25_000, estimated: false }],
      60,
    );
    expect(fare.pricePerKm).toBe(2000);
  });
});
