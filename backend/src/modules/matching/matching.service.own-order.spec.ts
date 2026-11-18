import { MatchingService } from './matching.service';
import { OrderStatus, ServiceType } from '../../database/entities/order.entity';

/**
 * Bitta raqam bilan ikkala ilova (`auth/session-role.ts`): haydovchi o'zi
 * taksi chaqirsa, eng yaqin haydovchi — o'zi. O'z buyurtmasi unga HECH
 * QACHON taklif qilinmasligi kerak (o'ziga o'zi zakaz berib bonus yig'ish).
 */
describe("MatchingService — o'z buyurtmasi taklif qilinmaydi", () => {
  const orderId = 'ride-1';
  const order = {
    id: orderId,
    passengerId: 'driver-self',
    status: OrderStatus.SEARCHING,
    pickupAddress: 'A',
    dropoffAddress: 'B',
    estimatedPrice: 15000,
    createdAt: new Date(),
    paymentMethod: 'cash',
    serviceType: ServiceType.TAXI,
  };
  const driver = (userId: string, distanceKm: number) => ({
    driverId: `row-${userId}`,
    userId,
    distanceKm,
    lat: 40.1,
    lng: 69.1,
  });

  function build(nearby: Array<ReturnType<typeof driver>>) {
    const store = new Map<string, string>();
    const active = new Set<string>();
    const redis = {
      get: jest.fn(async (k: string) => store.get(k) ?? null),
      set: jest.fn(async (k: string, v: string, ...flags: unknown[]) => {
        if (flags.includes('NX') && store.has(k)) return null;
        store.set(k, v);
        return 'OK';
      }),
      del: jest.fn(async (k: string) => store.delete(k)),
      eval: jest.fn(async (_s: string, _n: number, k: string, t: string) => (store.get(k) === t && store.delete(k) ? 1 : 0)),
      sadd: jest.fn(async (_k: string, m: string) => active.add(m)),
      srem: jest.fn(async (_k: string, m: string) => active.delete(m)),
      smembers: jest.fn(async () => [...active]),
    };
    const gateway = { emitToUser: jest.fn() };
    const drivers = {
      getNearbyDrivers: jest.fn(async () => nearby),
      isStillOfferable: jest.fn().mockResolvedValue(true),
    };
    const service = new MatchingService(
      {
        findOne: jest.fn(async () => order),
        update: jest.fn(),
        query: jest
          .fn()
          .mockResolvedValueOnce([{ lat: 40.1, lng: 69.1 }])
          .mockResolvedValue([{ pickup_lat: '40.1', pickup_lng: '69.1', dropoff_lat: '40.2', dropoff_lng: '69.2' }]),
      } as never,
      drivers as never,
      gateway as never,
      { notifyNewOrderOffer: jest.fn() } as never,
      { findById: jest.fn(async () => ({ id: 'u', fcmToken: null })) } as never,
      { findById: jest.fn(async () => ({ id: 't', tier: 1, vehicleType: null })) } as never,
      { durationsTo: jest.fn(async () => null) } as never,
      redis as never,
    );
    return { service, gateway };
  }

  const offeredTo = (gateway: { emitToUser: jest.Mock }) =>
    gateway.emitToUser.mock.calls.filter((c) => c[1] === 'new_order_offer').map((c) => c[0]);

  it("eng yaqin haydovchi buyurtma egasi bo'lsa — taklif keyingisiga", async () => {
    const { service, gateway } = build([driver('driver-self', 0.01), driver('other', 1.2)]);

    await service.startSearch(orderId);

    expect(offeredTo(gateway)).toEqual(['other']);
  });

  it("atrofda faqat egasi bo'lsa — hech kimga taklif yo'q", async () => {
    const { service, gateway } = build([driver('driver-self', 0.01)]);

    await service.startSearch(orderId);

    expect(offeredTo(gateway)).toEqual([]);
  });
});
