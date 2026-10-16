import { MatchingService, OFFER_TIMEOUT_MS, SEARCH_DEADLINE_MS, SEARCH_RADIUS_STEPS_KM } from './matching.service';
import { OrderStatus, ServiceType } from '../../database/entities/order.entity';

/**
 * Dispetcherlik auditida topilgan nuqsonlar (2026-10-16):
 *   1. Qidiruv navbati saqlanmasdan oldin xato bo'lsa buyurtma SEARCHING da
 *      abadiy qolardi — sweep uni ko'rmasdi.
 *   2. Qidiruv 3 daqiqa davom etadi, radius 2 → 3 → 5 km kengayadi;
 *      "haydovchi topilmadi" shartli yoziladi va yo'lovchiga push boradi.
 *   5. Push kutilayotgan paytda kelgan rad etish yo'qolardi; sweep tiklari
 *      ustma-ust tushishi mumkin edi.
 *   6. Taklif paytida bekor qilingan buyurtma haydovchi ekranida qolardi.
 */
describe('MatchingService — dispetcherlik tuzatishlari', () => {
  const orderId = 'order-1';
  const passengerId = 'passenger-1';
  const queueKey = `matching:queue:${orderId}`;
  const hold = (userId: string) => `matching:offer:${userId}`;
  const coordsRow = { pickup_lat: '40.1', pickup_lng: '69.1', dropoff_lat: '40.2', dropoff_lng: '69.2' };

  let service: MatchingService;
  let orderRepository: { findOne: jest.Mock; update: jest.Mock; query: jest.Mock; find: jest.Mock };
  let driversService: { getNearbyDrivers: jest.Mock };
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
    driversService = { getNearbyDrivers: jest.fn().mockResolvedValue([]) };
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

  describe('1. navbat SEARCHING bilan birga saqlanadi', () => {
    it('SEARCHING faqat CREATED dan yoziladi (bekor qilingan buyurtma tirilmaydi)', async () => {
      orderRepository.update.mockResolvedValueOnce({ affected: 0 });
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);

      await service.startSearch(orderId);

      expect(orderRepository.update).toHaveBeenCalledWith(
        { id: orderId, status: OrderStatus.CREATED },
        { status: OrderStatus.SEARCHING },
      );
      expect(offeredTo()).toEqual([]);
      expect(store.has(queueKey)).toBe(false);
      expect(realtimeGateway.emitToUser).not.toHaveBeenCalledWith(passengerId, 'order:searching', expect.anything());
    });

    it('taklif yo‘lida xato bo‘lsa ham navbat (deadline bilan) saqlanib qoladi — sweep egalik qiladi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      usersService.findById.mockRejectedValue(new Error('db down'));

      await expect(service.startSearch(orderId)).resolves.toBeUndefined();

      expect(activeSet.has(orderId)).toBe(true);
      expect(savedQueue().noDriverDeadline).toBeGreaterThan(Date.now());
    });

    it('koordinata so‘rovi yiqilsa ham navbat qoladi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      orderRepository.query.mockReset();
      orderRepository.query
        .mockResolvedValueOnce([{ lat: 40.1, lng: 69.1 }])
        .mockRejectedValue(new Error('pg timeout'));

      await service.startSearch(orderId);

      expect(activeSet.has(orderId)).toBe(true);
    });

    it('reaper: navbatsiz eskirgan SEARCHING buyurtmani "topilmadi" deb bekor qiladi', async () => {
      orderRepository.find.mockResolvedValue([{ id: 'orphan', passengerId }]);
      orderRepository.findOne.mockResolvedValue(makeOrder({ id: 'orphan', status: OrderStatus.CANCELLED }));

      await service.reapOrphanedSearches();

      expect(orderRepository.update).toHaveBeenCalledWith(
        { id: 'orphan', status: expect.anything() },
        expect.objectContaining({ status: OrderStatus.CANCELLED, cancelReason: 'No drivers available' }),
      );
      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        passengerId,
        'no_drivers_found',
        expect.objectContaining({ orderId: 'orphan' }),
      );
    });

    it('reaper: navbati bor buyurtmaga tegmaydi', async () => {
      store.set('matching:queue:alive', '{}');
      orderRepository.find.mockResolvedValue([{ id: 'alive', passengerId }]);

      await service.reapOrphanedSearches();

      expect(orderRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('2. 3 daqiqalik qidiruv va radius kengayishi', () => {
    it('konstantalar: 3 daqiqa, 2 → 3 → 5 km, taklif 15 s', () => {
      expect(SEARCH_DEADLINE_MS).toBe(180_000);
      expect([...SEARCH_RADIUS_STEPS_KM]).toEqual([2, 3, 5]);
      expect(OFFER_TIMEOUT_MS).toBe(15_000);
    });

    it('qidiruv 2 km dan boshlanadi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);

      await service.startSearch(orderId);

      expect(driversService.getNearbyDrivers.mock.calls[0][2]).toBe(2);
      expect(offeredTo()).toEqual(['driver-a']);
    });

    it('2 km da hech kim bo‘lmasa darhol 3 km, keyin 5 km ga kengayadi', async () => {
      driversService.getNearbyDrivers.mockImplementation((_lat: number, _lng: number, radius: number) =>
        Promise.resolve(radius >= 5 ? [makeDriver('far', 4.5)] : []),
      );

      await service.startSearch(orderId);

      expect(driversService.getNearbyDrivers.mock.calls.map((c) => c[2])).toEqual([2, 3, 5]);
      expect(offeredTo()).toEqual(['far']);
    });

    it('2 km dagilar rad etgach, keyingi qidiruv 3 km ga kengayadi', async () => {
      const near = makeDriver('near', 1);
      const mid = makeDriver('mid', 2.6);
      driversService.getNearbyDrivers.mockImplementation((_lat: number, _lng: number, radius: number) =>
        Promise.resolve(radius >= 3 ? [near, mid] : [near]),
      );
      await service.startSearch(orderId);
      expect(offeredTo()).toEqual(['near']);

      await service.driverDeclined('near', orderId);
      await service.sweepExpiredOffers();

      expect(offeredTo()).toEqual(['near', 'mid']);
      expect(savedQueue().radiusStepIndex).toBe(1);
    });

    it('61 soniyada BEKOR QILINMAYDI (eski 60 s chegara), 181 soniyada bekor qilinadi', async () => {
      await service.startSearch(orderId);
      orderRepository.update.mockClear();

      await withNow(61_000, () => service.sweepExpiredOffers());
      expect(orderRepository.update).not.toHaveBeenCalled();

      await withNow(181_000, () => service.sweepExpiredOffers());
      expect(orderRepository.update).toHaveBeenCalledWith(
        { id: orderId, status: OrderStatus.SEARCHING },
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
    });

    it('haydovchi shu orada qabul qilgan bo‘lsa — bekor qilmaydi va yo‘lovchiga xabar bermaydi', async () => {
      await service.startSearch(orderId);
      orderRepository.update.mockResolvedValue({ affected: 0 }); // status endi ACCEPTED

      await withNow(SEARCH_DEADLINE_MS + 1000, () => service.sweepExpiredOffers());

      expect(realtimeGateway.emitToUser).not.toHaveBeenCalledWith(passengerId, 'no_drivers_found', expect.anything());
      expect(notificationsService.notifyOrderCancelled).not.toHaveBeenCalled();
      expect(activeSet.has(orderId)).toBe(false);
    });

    it('topilmadi: yo‘lovchiga PUSH ham boradi', async () => {
      await service.startSearch(orderId);
      orderRepository.findOne.mockResolvedValue(makeOrder({ status: OrderStatus.CANCELLED }));

      await withNow(SEARCH_DEADLINE_MS + 1000, () => service.sweepExpiredOffers());

      expect(usersService.findById).toHaveBeenCalledWith(passengerId);
      expect(notificationsService.notifyOrderCancelled).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u' }),
        expect.objectContaining({ id: orderId }),
        'No drivers available',
      );
    });

    it('topilmadi: taklifni ko‘rib turgan haydovchi bo‘shatiladi va order:cancelled oladi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      await service.startSearch(orderId);
      expect(store.get(hold('driver-a'))).toBe(orderId);

      await withNow(SEARCH_DEADLINE_MS + 1000, () => service.sweepExpiredOffers());

      expect(store.has(hold('driver-a'))).toBe(false);
      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'driver-a',
        'order:cancelled',
        expect.objectContaining({ orderId }),
      );
    });
  });

  describe('3. isOfferedTo — qabul darvozasi uchun', () => {
    it('taklif qilingan haydovchi uchun true, boshqasi uchun false', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a'), makeDriver('driver-b', 2)]);
      await service.startSearch(orderId);

      await expect(service.isOfferedTo('driver-a', orderId)).resolves.toBe(true);
      await expect(service.isOfferedTo('driver-b', orderId)).resolves.toBe(false);
    });

    it('vaqt tugagach ham band belgisi qisqa muddat qoladi (kech bosilgan "qabul" o‘tadi)', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a'), makeDriver('driver-b', 2)]);
      await service.startSearch(orderId);

      await withNow(OFFER_TIMEOUT_MS + 1000, () => service.sweepExpiredOffers());

      expect(offeredTo()).toEqual(['driver-a', 'driver-b']);
      await expect(service.isOfferedTo('driver-a', orderId)).resolves.toBe(true);
    });

    it('rad etgan haydovchi uchun false', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a'), makeDriver('driver-b', 2)]);
      await service.startSearch(orderId);

      await service.driverDeclined('driver-a', orderId);

      await expect(service.isOfferedTo('driver-a', orderId)).resolves.toBe(false);
    });
  });

  describe('5. push paytidagi rad etish va sweep qayta-kirishi', () => {
    it('navbat (indeks + muddat) push yuborilishidan OLDIN saqlanadi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a'), makeDriver('driver-b', 2)]);
      let snapshot: { offerExpiresAt: number; currentIndex: number; drivers: Array<{ userId: string }> } | null =
        null;
      notificationsService.notifyNewOrderOffer.mockImplementation(() => {
        snapshot = JSON.parse(store.get(queueKey) ?? 'null');
        return Promise.resolve();
      });

      await service.startSearch(orderId);

      expect(snapshot).not.toBeNull();
      expect(snapshot!.offerExpiresAt).toBeGreaterThan(Date.now());
      expect(snapshot!.drivers[snapshot!.currentIndex].userId).toBe('driver-a');
    });

    it('push kutilmaydi: osilib qolgan FCM taklifni to‘xtatmaydi, rad etish keyingi haydovchiga o‘tadi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a'), makeDriver('driver-b', 2)]);
      notificationsService.notifyNewOrderOffer.mockReturnValue(new Promise(() => undefined));

      await service.startSearch(orderId);
      await service.driverDeclined('driver-a', orderId);

      expect(offeredTo()).toEqual(['driver-a', 'driver-b']);
    });

    it('push xatosi taklifni buzmaydi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      notificationsService.notifyNewOrderOffer.mockRejectedValue(new Error('fcm 500'));

      await expect(service.startSearch(orderId)).resolves.toBeUndefined();
      expect(savedQueue().offerExpiresAt).toBeGreaterThan(Date.now());
    });

    it('oldingi tik tugamagan bo‘lsa keyingi tik o‘tkazib yuboriladi', async () => {
      await service.startSearch(orderId); // bo'sh navbat — sweep qayta qidiradi
      driversService.getNearbyDrivers.mockClear();
      let release!: () => void;
      driversService.getNearbyDrivers.mockReturnValue(
        new Promise((resolve) => {
          release = () => resolve([]);
        }),
      );

      const first = service.sweepExpiredOffers();
      await new Promise((r) => setImmediate(r));
      await service.sweepExpiredOffers();
      const callsDuringFirst = driversService.getNearbyDrivers.mock.calls.length;
      release();
      await first;

      expect(callsDuringFirst).toBe(1);
    });

    it('boshqa instans shu buyurtmani qulflagan bo‘lsa, sweep unga tegmaydi', async () => {
      await service.startSearch(orderId);
      driversService.getNearbyDrivers.mockClear();
      store.set(`matching:lock:${orderId}`, 'other-instance');

      await service.sweepExpiredOffers();

      expect(driversService.getNearbyDrivers).not.toHaveBeenCalled();
    });

    it('qulf ATOMIK bo‘shatiladi (GET+DEL emas) — TTL tugab boshqa instans olgan qulf o‘chmaydi', async () => {
      const lockKey = `matching:lock:${orderId}`;
      driversService.getNearbyDrivers.mockImplementation(async () => {
        // Sweep cho'zildi: TTL tugadi va boshqa instans qulfni oldi.
        store.set(lockKey, 'other-instance');
        return [];
      });
      await service.startSearch(orderId);
      (redis.del as jest.Mock).mockClear();
      store.delete(lockKey);

      await service.sweepExpiredOffers();

      expect(store.get(lockKey)).toBe('other-instance');
      expect(redis.del).not.toHaveBeenCalledWith(lockKey);
      expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining('del'), 1, lockKey, expect.any(String));
    });
  });

  describe('6. cancelSearch — taklif paytida bekor qilish', () => {
    it('joriy taklif egasiga order:cancelled yuboradi, band belgisini va navbatni o‘chiradi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      await service.startSearch(orderId);

      await service.cancelSearch(orderId, 'Passenger cancelled');

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'driver-a',
        'order:cancelled',
        expect.objectContaining({ orderId, reason: 'Passenger cancelled' }),
      );
      expect(store.has(hold('driver-a'))).toBe(false);
      expect(store.has(queueKey)).toBe(false);
      expect(activeSet.has(orderId)).toBe(false);
    });

    it('band belgisi boshqa buyurtmaga o‘tgan haydovchiga xabar YUBORMAYDI', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      await service.startSearch(orderId);
      store.set(hold('driver-a'), 'order-other');

      await service.cancelSearch(orderId);

      expect(realtimeGateway.emitToUser).not.toHaveBeenCalledWith('driver-a', 'order:cancelled', expect.anything());
      expect(store.get(hold('driver-a'))).toBe('order-other');
    });

    it('exceptDriverId — qo‘lda biriktirilgan haydovchiga "bekor" yubormaydi, faqat bo‘shatadi', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a')]);
      await service.startSearch(orderId);

      await service.cancelSearch(orderId, 'Reassigned', 'driver-a');

      expect(realtimeGateway.emitToUser).not.toHaveBeenCalledWith('driver-a', 'order:cancelled', expect.anything());
      expect(store.has(hold('driver-a'))).toBe(false);
    });

    it('navbat yo‘q bo‘lsa jim o‘tadi', async () => {
      await expect(service.cancelSearch('nothing')).resolves.toBeUndefined();
    });
  });
});
