import { MatchingService } from './matching.service';
import { OrderStatus } from '../../database/entities/order.entity';

describe('MatchingService (Redis-backed queue)', () => {
  let service: MatchingService;
  let orderRepository: {
    findOne: jest.Mock;
    update: jest.Mock;
    query: jest.Mock;
  };
  let driversService: { getNearbyDrivers: jest.Mock };
  let realtimeGateway: { emitToUser: jest.Mock };
  let notificationsService: { notifyNewOrderOffer: jest.Mock };
  let usersService: { findById: jest.Mock };
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

    it('cancels the order once every driver in the queue has declined', async () => {
      driversService.getNearbyDrivers.mockResolvedValue([makeDriver('driver-a', 1)]);
      await service.startSearch(orderId);

      await service.driverDeclined('driver-a', orderId);

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
