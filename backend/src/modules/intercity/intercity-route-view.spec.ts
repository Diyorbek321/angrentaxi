import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { toIntercityPointView } from './intercity-route-view';

const point = (overrides: Partial<IntercityPoint> = {}): IntercityPoint =>
  ({
    id: 'rohat',
    name: 'Rohat krugi',
    centerLat: 41.268028,
    centerLng: 69.366806,
    radiusKm: 1.5,
    extensionMaxKm: 0,
    extensionPricePerKm: 0,
    extensionComfortPricePerKm: null,
    isActive: true,
    sortOrder: 0,
    ...overrides,
  }) as IntercityPoint;

describe('toIntercityPointView — shahar ichiga davom', () => {
  it('o\'chiq — extension: null', () => {
    expect(toIntercityPointView(point()).extension).toBeNull();
  });

  it('yoqilgan — max km va ikkala narx', () => {
    expect(
      toIntercityPointView(point({ extensionMaxKm: 30, extensionPricePerKm: 2000, extensionComfortPricePerKm: 2500 }))
        .extension,
    ).toEqual({ maxKm: 30, pricePerKm: 2000, comfortPricePerKm: 2500 });
  });

  it('Comfort narxi berilmagan — Start narxi ko\'rsatiladi', () => {
    expect(toIntercityPointView(point({ extensionMaxKm: 30, extensionPricePerKm: 2000 })).extension).toEqual({
      maxKm: 30,
      pricePerKm: 2000,
      comfortPricePerKm: 2000,
    });
  });
});
