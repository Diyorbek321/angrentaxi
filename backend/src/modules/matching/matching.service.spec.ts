import { MatchingService } from './matching.service';
import { OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { VehicleType } from '../../database/entities/tariff.entity';
import { driverMatchesCapabilities } from '../drivers/driver-capabilities';

describe('MatchingService (Redis-backed queue)', () => {
  let service: MatchingService;
  let orderRepository: {
    findOne: jest.Mock;
    update: jest.Mock;
    query: jest.Mock;
  };
  let driversService: { getNearbyDrivers: jest.Mock };
  let osrmService: { durationsTo: jest.Mock };
  let realtimeGateway: { emitToUser: jest.Mock };
  let notificationsService: { notifyNewOrderOffer: jest.Mock };
  let usersService: { findById: jest.Mock };
  let tariffsService: { findById: jest.Mock };
  let redis: {
    store: Map<string, string>;
    activeSet: Set<string>;
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    sadd: jest.Mock;
    srem: jest.Mock;
    smembers: jest.Mock;
  };

  const orderId = 'order-1';
  const passengerId = 'passenger-1';
  const coordsRow = {
    pickup_lat: '40.1',
    pickup_lng: '69.1',
    dropoff_lat: '40.2',
    dropoff_lng: '69.2',
  };

  function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
    return {
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
    };
  }

  function makeDriver(userId: string, distanceKm = 1) {
    return { driverId: `driver-row-${userId}`, userId, distanceKm, lat: 40.1, lng: 69.1 };
  }

  beforeEach(() => {
    orderRepository = {
      findOne: jest.fn().mockResolvedValue(makeOrder()),
      update: jest.fn().mockResolvedValue(undefined),
      query: jest
        .fn()
        .mockResolvedValueOnce([{ lat: 40.1, lng: 69.1 }]) // startSearch's pickup coords query
        .mockResolvedValue([coordsRow]), // subsequent offerToDriver coords queries
    };
    driversService = { getNearbyDrivers: jest.fn().mockResolvedValue([]) };
    realtimeGateway = { emitToUser: jest.fn() };
    notificationsService = { notifyNewOrderOffer: jest.fn().mockResolvedValue(undefined) };
    usersService = { findById: jest.fn().mockResolvedValue({ id: 'u', fcmToken: null }) };
    tariffsService = {
      // Taksi tariflarida `vehicleType` null — transport turi bo'yicha filtr
      // qo'llanmaydi (cargo testlari buni o'z blokida almashtiradi).
      findById: jest.fn().mockResolvedValue({ id: 'tariff-1', tier: 1, vehicleType: null }),
    };
    // Routing is an accuracy layer, not a dependency of dispatch: returning
    // null here is the "router unavailable" path, so these tests keep
    // asserting the distance-ordered fallback.
    osrmService = { durationsTo: jest.fn().mockResolvedValue(null) };

    const store = new Map<string, string>();
    const activeSet = new Set<string>();
    redis = {
      store,
      activeSet,
      get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      set: jest.fn((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve('OK');
      }),
      del: jest.fn((key: string) => {
        store.delete(key);
        return Promise.resolve(1);
      }),
      sadd: jest.fn((_key: string, member: string) => {
        activeSet.add(member);
        return Promise.resolve(1);
      }),
      srem: jest.fn((_key: string, member: string) => {
        activeSet.delete(member);
        return Promise.resolve(1);
      }),
      smembers: jest.fn(() => Promise.resolve(Array.from(activeSet))),
    };

    service = new MatchingService(
      orderRepository as never,
      driversService as never,
      realtimeGateway as never,
      notificationsService as never,
      usersService as never,
      tariffsService as never,
      osrmService as never,
      redis as never,
    );
  });

  describe('startSearch', () => {
    it('offers the nearest driver and persists a Redis-backed queue', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([
        makeDriver('driver-a', 1),
        makeDriver('driver-b', 2),
      ]);

      await service.startSearch(orderId);

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'driver-a',
        'new_order_offer',
        expect.objectContaining({ id: orderId }),
      );
      expect(notificationsService.notifyNewOrderOffer).toHaveBeenCalled();

      // Queue state actually landed in Redis, not just in-process memory.
      expect(redis.store.has('matching:queue:order-1')).toBe(true);
      expect(redis.activeSet.has(orderId)).toBe(true);
    });

    it('offers the driver with the shortest driving time, not the shortest straight line', async () => {
      // driver-a is closer as the crow flies but 8 minutes away by road (the
      // classic "other side of the river" case); driver-b is 3 minutes away.
      driversService.getNearbyDrivers.mockResolvedValue([
        makeDriver('driver-a', 0.4),
        makeDriver('driver-b', 0.9),
      ]);
      osrmService.durationsTo.mockResolvedValue([480, 180]);

      await service.startSearch(orderId);

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'driver-b',
        'new_order_offer',
        expect.objectContaining({ id: orderId }),
      );
    });

    it('keeps the distance order when the router is unreachable', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([
        makeDriver('driver-a', 0.4),
        makeDriver('driver-b', 0.9),
      ]);
      osrmService.durationsTo.mockResolvedValue(null);

      await service.startSearch(orderId);

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'driver-a',
        'new_order_offer',
        expect.objectContaining({ id: orderId }),
      );
    });

    it('ranks a driver OSRM cannot route to by distance instead of dropping them', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([
        makeDriver('driver-a', 0.5),
        makeDriver('driver-b', 2.5),
      ]);
      // driver-a sits on a street OSRM has no geometry for; at 25 km/h its
      // 0.5 km fallback still beats driver-b's real 400 s.
      osrmService.durationsTo.mockResolvedValue([null, 400]);

      await service.startSearch(orderId);

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'driver-a',
        'new_order_offer',
        expect.objectContaining({ id: orderId }),
      );
    });

    it('when no drivers are nearby, records a queue with an empty driver list instead of offering anyone', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([]);

      await service.startSearch(orderId);

      expect(realtimeGateway.emitToUser).not.toHaveBeenCalledWith(
        expect.anything(),
        'new_order_offer',
        expect.anything(),
      );
      expect(redis.activeSet.has(orderId)).toBe(true);
      const saved = JSON.parse(redis.store.get('matching:queue:order-1')!);
      expect(saved.drivers).toEqual([]);
    });
  });

  describe('driverDeclined', () => {
    it('advances to the next driver in the queue', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([
        makeDriver('driver-a', 1),
        makeDriver('driver-b', 2),
      ]);
      await service.startSearch(orderId);
      realtimeGateway.emitToUser.mockClear();

      await service.driverDeclined('driver-a', orderId);

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'driver-b',
        'new_order_offer',
        expect.anything(),
      );
    });

    it('keeps searching instead of cancelling once every driver in the queue has declined', async () => {
      // The order used to be cancelled the instant the last driver in the
      // first batch declined, throwing away most of the 60s search window.
      // Now the queue stays active so the sweep can re-search for drivers who
      // come online in the meantime.
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a', 1)]);
      await service.startSearch(orderId);
      orderRepository.update.mockClear();

      await service.driverDeclined('driver-a', orderId);

      expect(orderRepository.update).not.toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
      expect(redis.activeSet.has(orderId)).toBe(true);
    });

    it('offers the order to a driver who comes online after the first batch declined', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a', 1)]);
      await service.startSearch(orderId);
      await service.driverDeclined('driver-a', orderId);
      realtimeGateway.emitToUser.mockClear();

      // A new driver appears in range; the previous decliner is still listed
      // and must not be offered the same ride again.
      driversService.getNearbyDrivers.mockResolvedValue([
        makeDriver('driver-a', 1),
        makeDriver('driver-c', 2),
      ]);

      await service.sweepExpiredOffers();

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'driver-c',
        'new_order_offer',
        expect.anything(),
      );
      expect(realtimeGateway.emitToUser).not.toHaveBeenCalledWith(
        'driver-a',
        'new_order_offer',
        expect.anything(),
      );
    });

    it('cancels the order when the overall search deadline passes with no driver', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([]);
      await service.startSearch(orderId);

      // Jump past the 60s no-driver deadline.
      const realNow = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(realNow + 61_000);
      await service.sweepExpiredOffers();
      nowSpy.mockRestore();

      expect(orderRepository.update).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
      expect(redis.activeSet.has(orderId)).toBe(false);
    });

    it('ignores a stale decline for a driver who is no longer the current offer (race guard)', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([
        makeDriver('driver-a', 1),
        makeDriver('driver-b', 2),
      ]);
      await service.startSearch(orderId);
      await service.driverDeclined('driver-a', orderId); // now offering driver-b
      realtimeGateway.emitToUser.mockClear();
      orderRepository.update.mockClear();

      // A duplicate decline for driver-a (already advanced past) must not
      // double-advance the queue or cancel the order early.
      await service.driverDeclined('driver-a', orderId);

      expect(realtimeGateway.emitToUser).not.toHaveBeenCalled();
      expect(orderRepository.update).not.toHaveBeenCalled();
    });
  });

  /**
   * Buyurtma turi bo'yicha filtr — shu o'zgarishning asosiy sababi.
   *
   * Ilgari `startSearch` filtrni umuman uzatmasdi: yuk buyurtmasi 3 km
   * ichidagi HAR QANDAY onlayn haydovchiga, sedan egasiga ham tarqalardi.
   *
   * Bu yerdagi soxta `getNearbyDrivers` nomzodlar hovuzi ustida HAQIQIY
   * predikatni (`driverMatchesCapabilities`) ishlatadi. Shuning uchun test
   * ikki narsani birdan tekshiradi: matching to'g'ri talabni uzatayaptimi va
   * predikat to'g'ri hukm chiqaryaptimi. Filtrni testda qaytadan yozsak,
   * ikkalasi vaqt o'tib ajralib ketardi.
   */
  describe('buyurtma turi bo‘yicha filtr', () => {
    interface PoolDriver {
      userId: string;
      distanceKm: number;
      serviceTypes: ServiceType[] | null;
      vehicleType: VehicleType | null;
    }

    function sedan(userId: string, distanceKm: number): PoolDriver {
      return { userId, distanceKm, serviceTypes: [ServiceType.TAXI], vehicleType: null };
    }

    function van(userId: string, distanceKm: number): PoolDriver {
      return {
        userId,
        distanceKm,
        serviceTypes: [ServiceType.CARGO],
        vehicleType: VehicleType.VAN,
      };
    }

    function usePool(pool: PoolDriver[]) {
      driversService.getNearbyDrivers.mockImplementation(
        (_lat, _lng, _radius, _tier, capabilities) =>
          Promise.resolve(
            pool
              .filter((driver) => driverMatchesCapabilities(driver, capabilities))
              .map((driver) => makeDriver(driver.userId, driver.distanceKm)),
          ),
      );
    }

    function cargoOrder() {
      orderRepository.findOne.mockResolvedValue(
        makeOrder({ serviceType: ServiceType.CARGO }),
      );
      tariffsService.findById.mockResolvedValue({
        id: 'tariff-cargo-van',
        tier: 1,
        vehicleType: VehicleType.VAN,
      });
    }

    function offeredTo(): string[] {
      return realtimeGateway.emitToUser.mock.calls
        .filter((call: unknown[]) => call[1] === 'new_order_offer')
        .map((call: unknown[]) => call[0] as string);
    }

    it('yuk buyurtmasini yaqinroqdagi sedan haydovchiga TAKLIF QILMAYDI', async () => {
      cargoOrder();
      // Sedan ikki barobar yaqin — eski kodda taklif aynan unga ketardi.
      usePool([sedan('sedan-driver', 0.4), van('van-driver', 0.9)]);

      await service.startSearch(orderId);

      expect(offeredTo()).toEqual(['van-driver']);
    });

    it('yuk buyurtmasini furgon haydovchisiga taklif qiladi', async () => {
      cargoOrder();
      usePool([van('van-driver', 1.2)]);

      await service.startSearch(orderId);

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'van-driver',
        'new_order_offer',
        expect.objectContaining({ id: orderId }),
      );
    });

    it('taksi buyurtmasi avvalgidek ishlaydi (regressiya)', async () => {
      usePool([sedan('sedan-driver', 0.4), van('van-driver', 0.9)]);

      await service.startSearch(orderId);

      expect(offeredTo()).toEqual(['sedan-driver']);
    });

    it('serviceTypes BO‘SH haydovchi taksi buyurtmasini oladi (orqaga moslik)', async () => {
      // Migratsiyagacha ro'yxatdan o'tgan haydovchi. Bo'shlikni "hech nima"
      // deb o'qisak, deploy lahzasida birorta taksi buyurtmasi ham
      // taqsimlanmay qolardi.
      usePool([{ userId: 'legacy-driver', distanceKm: 0.6, serviceTypes: [], vehicleType: null }]);

      await service.startSearch(orderId);

      expect(offeredTo()).toEqual(['legacy-driver']);
    });

    it('mos haydovchi yo‘q bo‘lsa "topilmadi" oqimi ishlaydi, filtr uni chetlab o‘tmaydi', async () => {
      cargoOrder();
      // Atrofda faqat sedanlar bor — ular yuk buyurtmasini bajara olmaydi.
      usePool([sedan('sedan-a', 0.4), sedan('sedan-b', 0.7)]);

      await service.startSearch(orderId);

      expect(offeredTo()).toEqual([]);
      // Navbat saqlanadi: deadline'gacha qayta-qidiruv davom etadi.
      expect(redis.activeSet.has(orderId)).toBe(true);
      expect(JSON.parse(redis.store.get('matching:queue:order-1')!).drivers).toEqual([]);

      const realNow = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(realNow + 61_000);
      await service.sweepExpiredOffers();
      nowSpy.mockRestore();

      expect(orderRepository.update).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({
          status: OrderStatus.CANCELLED,
          cancelReason: 'No drivers available',
        }),
      );
      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        passengerId,
        'no_drivers_found',
        expect.objectContaining({ orderId }),
      );
    });

    it('ETA tartiblash filtrdan KEYINGI ro‘yxatga qo‘llanadi', async () => {
      cargoOrder();
      // Sedan eng yaqin, lekin filtrdan tushadi. OSRM davomiyliklari
      // filtrlangan ro'yxat tartibida keladi — agar filtr va ETA ro'yxatlari
      // siljib qolsa, taklif noto'g'ri furgonga ketardi.
      usePool([sedan('sedan-driver', 0.2), van('van-near', 0.5), van('van-far', 0.9)]);
      osrmService.durationsTo.mockResolvedValue([480, 180]);

      await service.startSearch(orderId);

      // Yaqinroq furgon yo'l bo'yicha 8 daqiqa, naridagisi 3 daqiqa.
      expect(offeredTo()).toEqual(['van-far']);
      expect(osrmService.durationsTo).toHaveBeenCalledWith(
        [
          [69.1, 40.1],
          [69.1, 40.1],
        ],
        [69.1, 40.1],
      );
      expect(osrmService.durationsTo.mock.calls[0][0]).toHaveLength(2);
    });

    it('qayta-qidiruv ham filtrni saqlaydi (navbat bilan birga yoziladi)', async () => {
      cargoOrder();
      usePool([sedan('sedan-driver', 0.4)]);
      await service.startSearch(orderId);

      // Bir furgon onlayn bo'ldi; sedan hamon eng yaqin.
      usePool([sedan('sedan-driver', 0.4), van('van-late', 1.5)]);
      await service.sweepExpiredOffers();

      expect(offeredTo()).toEqual(['van-late']);
    });

    it('Redis‘da qolgan ESKI navbat (imkoniyat maydonlarisiz) taksi deb o‘qiladi', async () => {
      // Deploy paytida yarim yo'ldagi qidiruvlar. `undefined` filtrga tushsa,
      // ular hech qanday talabsiz hammaga tarqalib ketardi.
      usePool([]);
      await service.startSearch(orderId);

      const key = 'matching:queue:order-1';
      const saved = JSON.parse(redis.store.get(key)!);
      delete saved.serviceType;
      delete saved.vehicleType;
      redis.store.set(key, JSON.stringify(saved));

      usePool([sedan('sedan-driver', 0.5), van('van-driver', 0.6)]);
      await service.sweepExpiredOffers();

      expect(offeredTo()).toEqual(['sedan-driver']);
    });

    // ------------------------------------------------------------------
    // OVQAT VA MARKET — aynan shu ikki vertikal uchun filtr qo'shilgandan
    // keyin hech qanday qamrov yo'q edi, holbuki muammo ular ustida:
    // migratsiya barcha haydovchilarga `['taxi']` yozgach, `FoodService`
    // va `MarketService` yaratgan buyurtmalar hech kimga mos kelmay
    // qoldi. Cargo testlari buni ushlamaydi — u transport turi bo'yicha
    // filtrlanadi, yetkazib berish esa XIZMAT TURI bo'yicha.
    // ------------------------------------------------------------------

    /** Yetkazib berish haydovchisi: yengil avtomobil, lekin food/market yoqilgan. */
    function courier(userId: string, distanceKm: number, types: ServiceType[]): PoolDriver {
      return { userId, distanceKm, serviceTypes: types, vehicleType: null };
    }

    /**
     * Yetkazib berish buyurtmasi. `vehicleType: null` ATAYLAB — ovqat/market
     * tariflari transport turini talab qilmaydi (seed'dagi izohga qarang),
     * ya'ni filtr FAQAT xizmat turi bo'yicha ishlashi kerak.
     */
    function deliveryOrder(serviceType: ServiceType) {
      orderRepository.findOne.mockResolvedValue(makeOrder({ serviceType }));
      tariffsService.findById.mockResolvedValue({
        id: `tariff-${serviceType}`,
        tier: 1,
        vehicleType: null,
      });
    }

    it('ovqat buyurtmasi ovqat yoqilgan haydovchiga boradi, taksichiga emas', async () => {
      deliveryOrder(ServiceType.FOOD);
      // Taksichi ikki barobar yaqin — u yutib ketmasligi kerak.
      usePool([
        sedan('taxi-only', 0.3),
        courier('food-courier', 0.9, [ServiceType.TAXI, ServiceType.FOOD]),
      ]);

      await service.startSearch(orderId);

      expect(offeredTo()).toEqual(['food-courier']);
    });

    it('market buyurtmasi market yoqilgan haydovchiga boradi', async () => {
      deliveryOrder(ServiceType.MARKET);
      usePool([
        sedan('taxi-only', 0.3),
        courier('market-courier', 1.1, [ServiceType.TAXI, ServiceType.MARKET]),
      ]);

      await service.startSearch(orderId);

      expect(offeredTo()).toEqual(['market-courier']);
    });

    it('faqat ovqat yoqqan haydovchiga MARKET buyurtmasi bormaydi', async () => {
      deliveryOrder(ServiceType.MARKET);
      usePool([courier('food-only', 0.4, [ServiceType.FOOD])]);

      await service.startSearch(orderId);

      expect(offeredTo()).toEqual([]);
    });

    it('ovqat buyurtmasi ham qayta-qidiruvda filtrni saqlaydi', async () => {
      // Restoran «tayyor» bosganda atrofda kuryer bo'lmasligi odatiy hol;
      // navbat 60 soniya davomida qayta-qidiradi va o'sha paytda ham
      // buyurtma taksichilarga tarqalib ketmasligi kerak.
      deliveryOrder(ServiceType.FOOD);
      usePool([sedan('taxi-only', 0.3)]);
      await service.startSearch(orderId);
      expect(offeredTo()).toEqual([]);

      usePool([
        sedan('taxi-only', 0.3),
        courier('food-late', 1.4, [ServiceType.FOOD]),
      ]);
      await service.sweepExpiredOffers();

      expect(offeredTo()).toEqual(['food-late']);
    });

    it('taklif paketi XIZMAT TURINI olib boradi — ilova matnlarni shundan quradi', async () => {
      // Maydonsiz paket xato bermaydi, JIMGINA taksi matnlarini
      // ko'rsatadi (`Order.fromJson` bo'sh qiymatni `taxi` deb o'qiydi):
      // haydovchi restorandan olinadigan buyurtmada «Yo'lovchigacha»
      // yozuvini ko'rib, qarorni noto'g'ri ma'lumot asosida qabul qilardi.
      deliveryOrder(ServiceType.FOOD);
      usePool([courier('food-courier', 0.5, [ServiceType.FOOD])]);

      await service.startSearch(orderId);

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'food-courier',
        'new_order_offer',
        expect.objectContaining({ serviceType: ServiceType.FOOD }),
      );
    });

    it('taksi taklifi ham turini aytadi (regressiya)', async () => {
      usePool([sedan('sedan-driver', 0.4)]);

      await service.startSearch(orderId);

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'sedan-driver',
        'new_order_offer',
        expect.objectContaining({ serviceType: ServiceType.TAXI }),
      );
    });
  });

  describe('driverAccepted', () => {
    it('clears the Redis queue so the sweep stops touching this order', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a', 1)]);
      await service.startSearch(orderId);

      await service.driverAccepted('driver-a', orderId);

      expect(redis.store.has('matching:queue:order-1')).toBe(false);
      expect(redis.activeSet.has(orderId)).toBe(false);
    });
  });

  describe('sweepExpiredOffers (restart-durability)', () => {
    it('times out an expired per-driver offer it finds in Redis, even from a brand-new service instance', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([
        makeDriver('driver-a', 1),
        makeDriver('driver-b', 2),
      ]);
      await service.startSearch(orderId);

      // Simulate the offer having expired.
      const key = 'matching:queue:order-1';
      const saved = JSON.parse(redis.store.get(key)!);
      saved.offerExpiresAt = Date.now() - 1000;
      redis.store.set(key, JSON.stringify(saved));

      // Simulate a process restart: a fresh MatchingService instance reading
      // the same Redis state, with no in-memory carryover whatsoever.
      const freshService = new MatchingService(
        orderRepository as never,
        driversService as never,
        realtimeGateway as never,
        notificationsService as never,
        usersService as never,
        tariffsService as never,
        osrmService as never,
        redis as never,
      );
      realtimeGateway.emitToUser.mockClear();

      await freshService.sweepExpiredOffers();

      expect(realtimeGateway.emitToUser).toHaveBeenCalledWith(
        'driver-b',
        'new_order_offer',
        expect.anything(),
      );
    });

    it('cancels the order once the overall no-driver deadline has passed, regardless of offer state', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a', 1)]);
      await service.startSearch(orderId);

      const key = 'matching:queue:order-1';
      const saved = JSON.parse(redis.store.get(key)!);
      saved.noDriverDeadline = Date.now() - 1000;
      saved.offerExpiresAt = Date.now() + 60000; // offer itself hasn't expired yet
      redis.store.set(key, JSON.stringify(saved));

      await service.sweepExpiredOffers();

      expect(orderRepository.update).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
    });

    it('does nothing for orders whose offer has not expired yet', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([
        makeDriver('driver-a', 1),
        makeDriver('driver-b', 2),
      ]);
      await service.startSearch(orderId);
      realtimeGateway.emitToUser.mockClear();

      await service.sweepExpiredOffers();

      expect(realtimeGateway.emitToUser).not.toHaveBeenCalled();
    });

    it('self-heals stale active-set membership left behind by an already-deleted queue', async () => {
      redis.activeSet.add('ghost-order');

      await service.sweepExpiredOffers();

      expect(redis.activeSet.has('ghost-order')).toBe(false);
    });
  });
});
