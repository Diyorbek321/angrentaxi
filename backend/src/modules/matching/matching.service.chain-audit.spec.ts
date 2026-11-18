import {
  MatchingService,
  MISSED_OFFER_COOLDOWN_MS,
  OFFER_TIMEOUT_MS,
  SEARCH_DEADLINE_MS,
} from './matching.service';
import { OrderStatus, ServiceType } from '../../database/entities/order.entity';

/**
 * "Buyurtma → haydovchi" zanjiri auditi (2026-10-31):
 *   A. Taklifga ulgurmagan haydovchi butun qidiruvdan chiqib ketardi.
 *   B. Partiyadagi 2-/3-haydovchi taklif paytida qayta tekshirilmasdi.
 *   C. Taklif muddati tugaganini server haydovchiga aytmasdi.
 *   D. Rejali safar belgilangan vaqtdan 7 daqiqa oldin bekor bo'lardi.
 *   E. "Topilmadi" tozalashidagi Redis xatosi yo'lovchi xabarini yutardi.
 */
describe('MatchingService — zanjir auditi (2026-10-31)', () => {
  const orderId = 'order-1';
  const passengerId = 'passenger-1';
  const queueKey = `matching:queue:${orderId}`;
  const coordsRow = { pickup_lat: '40.1', pickup_lng: '69.1', dropoff_lat: '40.2', dropoff_lng: '69.2' };

  let service: MatchingService;
  let orderRepository: { findOne: jest.Mock; update: jest.Mock; query: jest.Mock; find: jest.Mock };
  let driversService: { getNearbyDrivers: jest.Mock; isStillOfferable: jest.Mock };
  let realtimeGateway: { emitToUser: jest.Mock };
  let notificationsService: { notifyNewOrderOffer: jest.Mock; notifyOrderCancelled: jest.Mock };
  let usersService: { findById: jest.Mock };
  let tariffsService: { findById: jest.Mock };
  let store: Map<string, string>;
  let activeSet: Set<string>;
  let redis: Record<string, jest.Mock>;

  const makeOrder = (overrides: Record<string, unknown> = {}) => ({
    id: orderId,
    passengerId,
    status: OrderStatus.SEARCHING,
    pickupAddress: 'A',
    dropoffAddress: 'B',
    estimatedPrice: 10000,
    createdAt: new Date(),
    paymentMethod: 'cash',
    serviceType: ServiceType.TAXI,
    ...overrides,
  });
  const makeDriver = (userId: string, distanceKm = 1) => ({
    driverId: `row-${userId}`,
    userId,
    distanceKm,
    lat: 40.1,
    lng: 69.1,
  });
  const offeredTo = () =>
    realtimeGateway.emitToUser.mock.calls
      .filter(([, event]) => event === 'new_order_offer')
      .map(([userId]) => userId as string);
  const savedQueue = () => JSON.parse(store.get(queueKey)!);
  const withNow = async (offsetMs: number, fn: () => Promise<void>) => {
    const realNow = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(realNow + offsetMs);
    try {
      await fn();
    } finally {
      spy.mockRestore();
    }
  };

  function build(): MatchingService {
    return new MatchingService(
      orderRepository as never,
      driversService as never,
      realtimeGateway as never,
      notificationsService as never,
      usersService as never,
      tariffsService as never,
      { durationsTo: jest.fn().mockResolvedValue(null) } as never,
      redis as never,
    );
  }

  beforeEach(() => {
    orderRepository = {
      findOne: jest.fn().mockResolvedValue(makeOrder()),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest
        .fn()
        .mockResolvedValueOnce([{ lat: 40.1, lng: 69.1 }])
        .mockResolvedValue([coordsRow]),
      find: jest.fn().mockResolvedValue([]),
    };
    driversService = {
      getNearbyDrivers: jest.fn().mockResolvedValue([]),
      isStillOfferable: jest.fn().mockResolvedValue(true),
    };
    realtimeGateway = { emitToUser: jest.fn() };
    notificationsService = {
      notifyNewOrderOffer: jest.fn().mockResolvedValue(undefined),
      notifyOrderCancelled: jest.fn().mockResolvedValue(undefined),
    };
    usersService = { findById: jest.fn().mockResolvedValue({ id: 'u', fcmToken: 'tok' }) };
    tariffsService = { findById: jest.fn().mockResolvedValue({ id: 't', tier: 1, vehicleType: null }) };

    store = new Map();
    activeSet = new Set();
    redis = {
      get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      set: jest.fn((k: string, v: string, ...flags: unknown[]) => {
        if (flags.includes('NX') && store.has(k)) return Promise.resolve(null);
        store.set(k, v);
        return Promise.resolve('OK');
      }),
      del: jest.fn((k: string) => Promise.resolve(store.delete(k) ? 1 : 0)),
      // Faqat qulfni bo'shatish skripti (compare-and-delete) emulyatsiyasi.
      eval: jest.fn((_script: string, _n: number, k: string, token: string) =>
        Promise.resolve(store.get(k) === token && store.delete(k) ? 1 : 0),
      ),
      exists: jest.fn((k: string) => Promise.resolve(store.has(k) ? 1 : 0)),
      sadd: jest.fn((_k: string, m: string) => Promise.resolve(activeSet.add(m) && 1)),
      srem: jest.fn((_k: string, m: string) => Promise.resolve(activeSet.delete(m) ? 1 : 0)),
      smembers: jest.fn(() => Promise.resolve([...activeSet])),
    };

    service = build();
  });


  describe('A. ulgurmagan haydovchi keyinroq yana nomzod', () => {
    it('vaqt tugashi rad etish emas: exhausted ga tushmaydi, missedAt yoziladi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      await service.startSearch(orderId);

      await withNow(OFFER_TIMEOUT_MS + 1000, () => service.sweepExpiredOffers());

      const queue = savedQueue();
      expect(queue.exhaustedDriverIds).toEqual([]);
      expect(typeof queue.missedAt['driver-a']).toBe('number');
    });

    it('yagona haydovchi: kutish oralig‘ida qayta taklif yo‘q, undan keyin — bor', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      await service.startSearch(orderId);

      await withNow(OFFER_TIMEOUT_MS + 1000, () => service.sweepExpiredOffers());
      await withNow(OFFER_TIMEOUT_MS + 5000, () => service.sweepExpiredOffers());
      expect(offeredTo()).toEqual(['driver-a']);

      await withNow(OFFER_TIMEOUT_MS + MISSED_OFFER_COOLDOWN_MS + 3000, () => service.sweepExpiredOffers());
      expect(offeredTo()).toEqual(['driver-a', 'driver-a']);
    });

    it('aniq rad etgan haydovchiga kutishdan keyin ham qayta taklif yo‘q', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      await service.startSearch(orderId);

      await service.driverDeclined('driver-a', orderId);
      await withNow(MISSED_OFFER_COOLDOWN_MS + 5000, () => service.sweepExpiredOffers());

      expect(offeredTo()).toEqual(['driver-a']);
      expect(savedQueue().exhaustedDriverIds).toEqual(['driver-a']);
    });
  });

  describe('B. partiyadagi keyingi haydovchi qayta tekshiriladi', () => {
    it('band/oflayn bo‘lib qolgan 2-haydovchiga taklif yuborilmaydi va u exhausted ga tushmaydi', async () => {
      driversService.getNearbyDrivers.mockResolvedValueOnce([makeDriver('driver-a'), makeDriver('driver-b', 2)]);
      driversService.isStillOfferable.mockResolvedValue(false);
      await service.startSearch(orderId);

      await service.driverDeclined('driver-a', orderId);

      expect(driversService.isStillOfferable).toHaveBeenCalledWith('row-driver-b', 'driver-b');
      expect(offeredTo()).toEqual(['driver-a']);
      const queue = savedQueue();
      expect(queue.exhaustedDriverIds).toEqual(['driver-a']);
      expect(queue.offerExpiresAt).toBe(0);
    });

    it('yangi qidiruvdan kelgan birinchi nomzod qayta tekshirilmaydi (ortiqcha so‘rov yo‘q)', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      await service.startSearch(orderId);

      expect(driversService.isStillOfferable).not.toHaveBeenCalled();
      expect(offeredTo()).toEqual(['driver-a']);
    });
  });

  describe('C. muddat tugaganda haydovchiga order:offer_expired', () => {
    it('vaqti tugagan haydovchi aniq xabar oladi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      await service.startSearch(orderId);

      await withNow(OFFER_TIMEOUT_MS + 1000, () => service.sweepExpiredOffers());

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith('driver-a', 'order:offer_expired', { orderId });
    });

    it('chegarada qabul qilingan (endi SEARCHING emas) — offer_expired yuborilmaydi, navbat yopiladi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      await service.startSearch(orderId);
      orderRepository.findOne.mockResolvedValue(makeOrder({ status: OrderStatus.ACCEPTED, driverId: 'driver-a' }));

      await withNow(OFFER_TIMEOUT_MS + 1000, () => service.sweepExpiredOffers());

      expect(realtimeGateway.emitToUser).not.toHaveBeenCalledWith('driver-a', 'order:offer_expired', expect.anything());
      expect(store.has(queueKey)).toBe(false);
      expect(activeSet.has(orderId)).toBe(false);
    });

    it('missedAt siz eski navbat (deploy paytida Redis’da qolgan) — vaqt tugashi ishlaydi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      await service.startSearch(orderId);
      const legacy = savedQueue();
      delete legacy.missedAt;
      store.set(queueKey, JSON.stringify(legacy));

      await withNow(OFFER_TIMEOUT_MS + 1000, () => service.sweepExpiredOffers());

      expect(typeof savedQueue().missedAt['driver-a']).toBe('number');
    });

    it('rad etgan haydovchiga offer_expired yuborilmaydi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      await service.startSearch(orderId);

      await service.driverDeclined('driver-a', orderId);

      expect(realtimeGateway.emitToUser).not.toHaveBeenCalledWith('driver-a', 'order:offer_expired', expect.anything());
    });
  });

  describe('D. rejali safar muddati belgilangan vaqtdan hisoblanadi', () => {
    it('searchDeadlineFor: oddiy buyurtma — hozir + 3 daqiqa', () => {
      expect(MatchingService.searchDeadlineFor({ scheduledAt: null } as never, 1_000)).toBe(1_000 + SEARCH_DEADLINE_MS);
    });

    it('searchDeadlineFor: kelajakdagi reja — belgilangan vaqt + 3 daqiqa', () => {
      const scheduledAt = new Date(10 * 60_000);
      expect(MatchingService.searchDeadlineFor({ scheduledAt } as never, 0)).toBe(10 * 60_000 + SEARCH_DEADLINE_MS);
    });

    it('searchDeadlineFor: kech qolgan reja — hozirdan 3 daqiqa (o‘tmishga emas)', () => {
      const now = 60 * 60_000;
      expect(MatchingService.searchDeadlineFor({ scheduledAt: new Date(0) } as never, now)).toBe(now + SEARCH_DEADLINE_MS);
    });

    it('10 daqiqa oldin boshlangan qidiruv 181-soniyada bekor bo‘lmaydi, navbat TTL muddatdan uzun', async () => {
      orderRepository.findOne.mockResolvedValue(makeOrder({ scheduledAt: new Date(Date.now() + 10 * 60_000) }));
      await service.startSearch(orderId);
      orderRepository.update.mockClear();

      await withNow(SEARCH_DEADLINE_MS + 1000, () => service.sweepExpiredOffers());
      expect(orderRepository.update).not.toHaveBeenCalled();

      const queueSet = redis.set.mock.calls.find(([k]) => k === queueKey)!;
      const ttl = queueSet[3] as number;
      expect(ttl).toBeGreaterThan((10 * 60_000 + SEARCH_DEADLINE_MS) / 1000);
    });
  });

  describe('E. "topilmadi" — Redis xatosi yo‘lovchi xabarini yutmaydi', () => {
    it('navbatni o‘chirish yiqilsa ham no_drivers_found yuboriladi', async () => {
      await service.startSearch(orderId);
      redis.del.mockRejectedValue(new Error('redis down'));

      await withNow(SEARCH_DEADLINE_MS + 1000, () => service.sweepExpiredOffers());

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        passengerId,
        'no_drivers_found',
        expect.objectContaining({ orderId }),
      );
    });
  });
});
