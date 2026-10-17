import { IntercityTripClass } from '../../database/entities/intercity-trip.entity';
import { haversineDistance } from '../orders/orders.distance.util';
import { ExtensionPoint, ROAD_DISTANCE_FALLBACK_FACTOR, kmFromMeters, priceExtension } from './intercity-extension';
import { IntercityExtensionPricer } from './intercity-extension-pricer';

const ROHAT: ExtensionPoint = {
  name: 'Rohat krugi',
  centerLat: 41.268028,
  centerLng: 69.366806,
  radiusKm: 1.5,
  extensionMaxKm: 30,
  extensionPricePerKm: 2000,
  extensionComfortPricePerKm: 2500,
};
const HOME = { lat: 41.3111, lng: 69.2797 };

function makePricer(roadMeters: number | null) {
  const osrm = { routeDistanceMeters: jest.fn().mockResolvedValue(roadMeters) };
  return { pricer: new IntercityExtensionPricer(osrm as never), osrm };
}

describe('IntercityExtensionPricer', () => {
  it('tushish: yo\'l masofasi nuqtadan manzilga, Start narxida', async () => {
    const { pricer, osrm } = makePricer(12_440);
    const charge = await pricer.charge('dropoff', ROHAT, IntercityTripClass.START, HOME);

    expect(osrm.routeDistanceMeters).toHaveBeenCalledWith(
      [
        [ROHAT.centerLng, ROHAT.centerLat],
        [HOME.lng, HOME.lat],
      ],
      expect.any(Number),
    );
    expect(charge).toEqual({
      side: 'dropoff',
      pointName: 'Rohat krugi',
      km: 12.4,
      pricePerKm: 2000,
      fare: 25_000,
      estimated: false,
    });
  });

  it('olish: yo\'l manzildan nuqtaga (teskari tartib), Comfort narxida', async () => {
    const { pricer, osrm } = makePricer(10_000);
    const charge = await pricer.charge('pickup', ROHAT, IntercityTripClass.COMFORT, HOME);

    expect(osrm.routeDistanceMeters).toHaveBeenCalledWith(
      [
        [HOME.lng, HOME.lat],
        [ROHAT.centerLng, ROHAT.centerLat],
      ],
      expect.any(Number),
    );
    expect(charge).toMatchObject({ side: 'pickup', km: 10, pricePerKm: 2500, fare: 25_000, estimated: false });
  });

  it('marshrut xizmati javob bermasa — to\'g\'ri chiziq × 1.3, estimated', async () => {
    const { pricer } = makePricer(null);
    const charge = await pricer.charge('dropoff', ROHAT, IntercityTripClass.START, HOME);

    const straightMeters = haversineDistance(ROHAT.centerLat, ROHAT.centerLng, HOME.lat, HOME.lng) * 1000;
    const km = kmFromMeters(straightMeters * ROAD_DISTANCE_FALLBACK_FACTOR);
    expect(charge).toMatchObject({ km, fare: priceExtension(km, 2000), estimated: true });
  });

  it('OSRM xato otsa ham taxminga o\'tadi', async () => {
    const osrm = { routeDistanceMeters: jest.fn().mockRejectedValue(new Error('down')) };
    const pricer = new IntercityExtensionPricer(osrm as never);
    await expect(pricer.charge('dropoff', ROHAT, IntercityTripClass.START, HOME)).resolves.toMatchObject({
      estimated: true,
    });
  });
});
