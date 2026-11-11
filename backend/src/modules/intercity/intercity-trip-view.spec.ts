import { IntercityTripClass, IntercityTripStatus } from '../../database/entities/intercity-trip.entity';
import { toIntercityTripManageView, toIntercityTripView } from './intercity-trip-view';

const trip = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'trip-1',
    routeId: 'route-1',
    route: {
      originPointId: 'a',
      destinationPointId: 'b',
      originPoint: { name: 'Angren' },
      destinationPoint: { name: 'Rohat krugi (Toshkent)' },
    },
    tripClass: IntercityTripClass.START,
    departureAt: new Date('2026-10-20T02:00:00.000Z'),
    status: IntercityTripStatus.FULL,
    seatsTotal: 4,
    seatsTaken: 4,
    wholeCarBooked: true,
    seatPrice: 25000,
    wholeCarPrice: 100000,
    cancelReason: null,
    driver: {
      rating: 4.9,
      carModel: 'Cobalt',
      licensePlate: '10A123BC',
      carNumber: null,
      user: { firstName: 'Ali', phone: '+998901112233' },
    },
    ...overrides,
  }) as never;

describe('intercity-trip-view', () => {
  it("ommaviy ko'rinish: wholeCarBooked bor, haydovchi telefoni YO'Q", () => {
    const view = toIntercityTripView(trip());

    expect(view.wholeCarBooked).toBe(true);
    expect(view.seatsLeft).toBe(0);
    expect(JSON.stringify(view)).not.toContain('+998901112233');
  });

  it("menejer ko'rinishi: haydovchi telefoni bilan", () => {
    const view = toIntercityTripManageView(trip({ wholeCarBooked: false, seatsTaken: 1, status: IntercityTripStatus.OPEN }));

    expect(view.wholeCarBooked).toBe(false);
    expect(view.driver).toMatchObject({ firstName: 'Ali', phone: '+998901112233' });
  });

  it("menejer ko'rinishi: haydovchi yuklanmagan bo'lsa null", () => {
    expect(toIntercityTripManageView(trip({ driver: undefined })).driver).toBeNull();
  });
});
