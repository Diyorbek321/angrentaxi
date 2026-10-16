import { MatchingService } from './matching.service';
import { OrderStatus, ServiceType } from '../../database/entities/order.entity';

/**
 * Hamyon rejimi (docs/LEGAL-COMPLIANCE.md §14): naqd ovqat/market
 * yetkazishi hamyonida tovar summasi yo'q kuryerga TAKLIF QILINMAYDI —
 * ilgari taklif borib, faqat qabul qilishda 400 qaytardi.
 */
describe('MatchingService — hamyon rejimida kuryer filtri', () => {
  const orderId = 'ride-1';
  const order = {
    id: orderId,
    passengerId: 'customer-1',
    status: OrderStatus.SEARCHING,
    pickupAddress: 'Restoran',
    dropoffAddress: 'Mijoz',
    estimatedPrice: 7000,
    createdAt: new Date(),
    paymentMethod: 'cash',
    serviceType: ServiceType.FOOD,
    details: { foodOrderId: 'fo-1', payVendor: 145000 },
  };
  const driver = (userId: string, distanceKm: number) => ({
    driverId: `row-${userId}`,
    userId,
    distanceKm,
    lat: 40.1,
    lng: 69.1,
  });

  function build(filter: jest.Mock | undefined) {
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
      // Qulfni bo'shatish (compare-and-delete).
      eval: jest.fn(async (_s: string, _n: number, k: string, t: string) => (store.get(k) === t && store.delete(k) ? 1 : 0)),
      sadd: jest.fn(async (_k: string, m: string) => active.add(m)),
      srem: jest.fn(async (_k: string, m: string) => active.delete(m)),
      smembers: jest.fn(async () => [...active]),
    };
    const gateway = { emitToUser: jest.fn() };
    const drivers = {
      getNearbyDrivers: jest.fn(async () => [driver('poor', 0.5), driver('rich', 1.5)]),
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
      undefined,
      (filter ? { filterCouriersByWallet: filter } : undefined) as never,
    );
    return { service, gateway, drivers };
  }

  it('balansi yetmagan kuryer o\'tkazib yuboriladi — taklif keyingisiga', async () => {
    const filter = jest.fn(async (amount: number, candidates: Array<{ userId: string }>) =>
      candidates.filter((c) => c.userId === 'rich'),
    );
    const { service, gateway } = build(filter);
    await service.startSearch(orderId);
    expect(filter).toHaveBeenCalledWith(145000, expect.any(Array));
    expect(gateway.emitToUser).toHaveBeenCalledWith('rich', 'new_order_offer', expect.anything());
    expect(gateway.emitToUser).not.toHaveBeenCalledWith('poor', 'new_order_offer', expect.anything());
  });

  it('qayta qidiruvda ham filtr qo\'llanadi', async () => {
    const filter = jest.fn(async (_a: number, _c: Array<{ userId: string }>): Promise<Array<{ userId: string }>> => []);
    const { service, gateway } = build(filter);
    await service.startSearch(orderId);
    filter.mockImplementation(async (_a: number, c: Array<{ userId: string }>) => c.filter((x) => x.userId === 'rich'));
    await service.sweepExpiredOffers();
    expect(filter).toHaveBeenLastCalledWith(145000, expect.any(Array));
    expect(gateway.emitToUser).toHaveBeenCalledWith('rich', 'new_order_offer', expect.anything());
  });

  it('servis yo\'q bo\'lsa (eski spec\'lar) — avvalgidek hammaga', async () => {
    const { service, gateway } = build(undefined);
    await service.startSearch(orderId);
    expect(gateway.emitToUser).toHaveBeenCalledWith('poor', 'new_order_offer', expect.anything());
  });
});
