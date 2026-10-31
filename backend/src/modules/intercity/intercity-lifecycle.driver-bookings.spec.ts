import { IntercityTripStatus } from '../../database/entities/intercity-trip.entity';
import { OrderStatus } from '../../database/entities/order.entity';
import { IntercityLifecycleService } from './intercity-lifecycle.service';

const DEPARTURE = new Date('2026-10-20T07:00:00.000Z');
const FAR_BEFORE = new Date('2026-10-19T07:00:00.000Z');
const IN_REVEAL_WINDOW = new Date('2026-10-20T06:30:00.000Z');

const ROW = {
  id: 'order-1',
  status: OrderStatus.SCHEDULED,
  seats: 1,
  booking_kind: 'seat',
  estimated_price: '25000.00',
  final_price: null,
  first_name: 'Ali',
  last_name: null,
  phone: '+998901112233',
  pickup_address: 'Angren',
  pickup_lat: '40.1',
  pickup_lng: '70.9',
  dropoff_address: 'Rohat krugi',
  dropoff_lat: '41.3',
  dropoff_lng: '69.3',
  created_at: new Date('2026-10-18T00:00:00.000Z'),
};

function build(options: { trip?: Record<string, unknown> | null; enabled?: boolean } = {}) {
  const trip =
    options.trip === null
      ? null
      : { id: 'trip-1', driverId: 'driver-1', status: IntercityTripStatus.OPEN, departureAt: DEPARTURE, ...options.trip };
  const tripRepository = { findOne: jest.fn(async () => trip) };
  const driverRepository = { findOne: jest.fn(async () => ({ id: 'driver-1', userId: 'driver-user-1' })) };
  const dataSource = { query: jest.fn(async (_sql: string, _params: unknown[]) => [ROW]), transaction: jest.fn() };
  const settings = { isIntercityEnabled: jest.fn(async () => options.enabled ?? true) };
  const service = new IntercityLifecycleService(
    tripRepository as never,
    {} as never,
    driverRepository as never,
    dataSource as never,
    settings as never,
    {} as never,
    {} as never,
  );
  return { service, tripRepository, dataSource };
}

describe('IntercityLifecycleService.listBookingsForDriver', () => {
  it("o'z qatnovi: bandlar koordinatalari bilan, faqat shu qatnov bo'yicha", async () => {
    const { service, tripRepository, dataSource } = build();
    const [view] = await service.listBookingsForDriver('driver-user-1', 'trip-1', FAR_BEFORE);
    expect(tripRepository.findOne).toHaveBeenCalledWith({ where: { id: 'trip-1', driverId: 'driver-1' } });
    expect(dataSource.query.mock.calls[0][1]).toEqual(['trip-1']);
    expect(String(dataSource.query.mock.calls[0][0])).toContain('ST_Y(o."pickup_location"');
    expect(view).toMatchObject({ orderId: 'order-1', pickupLat: 40.1, pickupLng: 70.9, price: 25000 });
  });

  it("jo'nashgacha uzoq — yo'lovchi telefoni yashirin", async () => {
    const { service } = build();
    const [view] = await service.listBookingsForDriver('driver-user-1', 'trip-1', FAR_BEFORE);
    expect(view.passenger.phone).toBeNull();
  });

  it("jo'nashga ≤60 daqiqa — telefon ochiq", async () => {
    const { service } = build();
    const [view] = await service.listBookingsForDriver('driver-user-1', 'trip-1', IN_REVEAL_WINDOW);
    expect(view.passenger.phone).toBe('+998901112233');
  });

  it("yig'ish boshlangan — vaqtdan qat'i nazar telefon ochiq", async () => {
    const { service } = build({ trip: { status: IntercityTripStatus.BOARDING } });
    const [view] = await service.listBookingsForDriver('driver-user-1', 'trip-1', FAR_BEFORE);
    expect(view.passenger.phone).toBe('+998901112233');
  });

  it('begona qatnov — 404 INTERCITY_TRIP_NOT_FOUND, SQL ishlamaydi', async () => {
    const { service, dataSource } = build({ trip: null });
    await expect(service.listBookingsForDriver('driver-user-1', 'trip-1', FAR_BEFORE)).rejects.toMatchObject({
      response: { code: 'INTERCITY_TRIP_NOT_FOUND' },
    });
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it("flag o'chiq — 404 INTERCITY_DISABLED", async () => {
    const { service } = build({ enabled: false });
    await expect(service.listBookingsForDriver('driver-user-1', 'trip-1', FAR_BEFORE)).rejects.toMatchObject({
      response: { code: 'INTERCITY_DISABLED' },
    });
  });
});
