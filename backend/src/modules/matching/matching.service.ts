import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import Redis from 'ioredis';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { DriversService, NearbyDriver } from '../drivers/drivers.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { TariffsService } from '../tariffs/tariffs.service';
import { REDIS_CLIENT } from '../../config/redis.config';

interface DriverQueue {
  orderId: string;
  drivers: NearbyDriver[];
  currentIndex: number;
  passengerId: string;
  // Epoch ms. 0 while no driver has an active offer yet (e.g. immediately
  // after startSearch finds zero nearby drivers).
  offerExpiresAt: number;
  // Epoch ms — absolute deadline for the whole search, independent of how
  // many individual driver offers have been tried.
  noDriverDeadline: number;
  // User ids already offered this order (declined or timed out). A re-search
  // skips them so the same driver isn't re-offered a ride they just refused.
  exhaustedDriverIds: string[];
  // Pickup point and tariff tier, cached so a re-search doesn't have to
  // re-read the order row on every sweep tick.
  pickupLat: number;
  pickupLng: number;
  tariffTier: number;
}

// Queue state used to live only in a process-local Map, with setTimeout +
// SchedulerRegistry driving offer/no-driver timeouts. That meant a deploy,
// crash, or restart mid-search silently dropped every in-flight order
// search — no timer ever fired again, so an order could get stuck in
// SEARCHING forever with no driver ever offered it.
//
// Queue state now lives in Redis (survives restarts), and a periodic sweep
// (sweepExpiredOffers, every 2s) replaces the per-timer setTimeout calls —
// on restart, the next sweep tick picks up exactly where the previous
// process left off instead of losing the search entirely.
//
// This is still single-writer-per-order in practice (one backend instance
// today, per the deployment setup) — if this service is ever run as
// multiple instances, two instances could both pick up the same expired
// offer in the same sweep tick and double-advance the queue. A distributed
// lock (e.g. Redis SETNX per orderId) would be needed at that point; not
// added here since it isn't the current deployment topology.
@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);
  private readonly OFFER_TIMEOUT_MS = 15000; // 15 seconds per driver
  private readonly NO_DRIVER_TIMEOUT_MS = 60000; // 60 seconds total
  private static readonly ACTIVE_SET_KEY = 'matching:active-orders';
  // Comfortably longer than NO_DRIVER_TIMEOUT_MS so a queue record never
  // expires out from under a search that's still legitimately running; the
  // sweep (not Redis TTL) is what ends a search on time.
  private static readonly QUEUE_TTL_SECONDS = 120;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly driversService: DriversService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly tariffsService: TariffsService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async startSearch(orderId: string): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order) {
      this.logger.error(`Order ${orderId} not found for matching`);
      return;
    }

    // Get pickup coordinates from PostGIS
    const locationResult = await this.orderRepository.query(
      `SELECT ST_X(pickup_location::geometry) as lng, ST_Y(pickup_location::geometry) as lat FROM orders WHERE id = $1`,
      [orderId],
    );

    if (!locationResult.length) {
      this.logger.error(`No location data for order ${orderId}`);
      return;
    }

    const { lat, lng } = locationResult[0] as { lat: number; lng: number };

    // Update order status to SEARCHING
    await this.orderRepository.update(orderId, { status: OrderStatus.SEARCHING });

    // Notify passenger that search started
    this.realtimeGateway.emitToUser(order.passengerId, 'order:searching', {
      orderId,
      message: 'Searching for nearby drivers...',
    });

    // Gate matching by the tariff's tier — e.g. a Biznes ride shouldn't be
    // offered to a driver only approved up to Start. Cargo tariffs/drivers
    // both default tier/approvedTariffTier to 1, so this is a no-op for them.
    const tariff = await this.tariffsService.findById(order.tariffId);

    // Find nearby drivers (3km radius)
    const nearbyDrivers = await this.driversService.getNearbyDrivers(lat, lng, 3, tariff.tier);
    const noDriverDeadline = Date.now() + this.NO_DRIVER_TIMEOUT_MS;

    const baseQueue: DriverQueue = {
      orderId,
      drivers: [],
      currentIndex: 0,
      passengerId: order.passengerId,
      offerExpiresAt: 0,
      noDriverDeadline,
      exhaustedDriverIds: [],
      pickupLat: lat,
      pickupLng: lng,
      tariffTier: tariff.tier,
    };

    if (nearbyDrivers.length === 0) {
      // Persist an empty queue; the sweep re-searches every tick until the
      // deadline, so a driver who comes online seconds later still gets the
      // ride. This used to log "will retry..." and then never retry — the
      // order simply sat idle for 60s and auto-cancelled.
      this.logger.log(
        `No drivers found near order ${orderId}; queued for re-search until deadline`,
      );
      await this.saveQueue(baseQueue);
      return;
    }

    this.logger.log(`Found ${nearbyDrivers.length} nearby drivers for order ${orderId}`);

    // Take nearest 3 drivers
    const topDrivers = nearbyDrivers.slice(0, 3);

    const queue: DriverQueue = { ...baseQueue, drivers: topDrivers };

    // Offer to first driver (persists the queue with offerExpiresAt set).
    await this.offerToDriver(orderId, topDrivers[0], queue);
  }

  async driverAccepted(driverId: string, orderId: string): Promise<void> {
    await this.deleteQueue(orderId);
    this.logger.log(`Driver ${driverId} accepted order ${orderId}`);
  }

  async driverDeclined(driverId: string, orderId: string): Promise<void> {
    const queue = await this.getQueue(orderId);
    if (!queue) return;

    const currentDriver = queue.drivers[queue.currentIndex];
    // Ignore a stale decline/timeout for a driver who isn't the current
    // offer — the socket-driven decline and the sweep's timeout can race
    // for the same driver; only the first should advance the queue.
    if (!currentDriver || currentDriver.userId !== driverId) return;

    this.logger.log(`Driver ${driverId} declined order ${orderId}`);

    queue.currentIndex += 1;
    if (!queue.exhaustedDriverIds.includes(driverId)) {
      queue.exhaustedDriverIds = [...queue.exhaustedDriverIds, driverId];
    }

    if (queue.currentIndex >= queue.drivers.length) {
      // Everyone in this batch passed. Don't give up yet — persist the
      // exhausted list and let the sweep look for drivers who have since come
      // online, right up to the overall deadline. Previously this cancelled
      // the order the moment the last of three drivers declined, even with
      // most of the search window still left.
      queue.offerExpiresAt = 0;
      await this.saveQueue(queue);
      return;
    }

    const nextDriver = queue.drivers[queue.currentIndex];
    await this.offerToDriver(orderId, nextDriver, queue);
  }

  async offerTimeout(driverId: string, orderId: string): Promise<void> {
    this.logger.log(`Offer to driver ${driverId} for order ${orderId} timed out`);
    await this.driverDeclined(driverId, orderId);
  }

  /// Runs every 2s, checking Redis-persisted queues for expired per-driver
  /// offers or an expired overall search deadline. Replaces the old
  /// setTimeout/SchedulerRegistry timers — because the state it reads lives
  /// in Redis rather than process memory, a restart between sweep ticks
  /// loses nothing.
  @Interval(2000)
  async sweepExpiredOffers(): Promise<void> {
    const orderIds = await this.redis.smembers(MatchingService.ACTIVE_SET_KEY);

    for (const orderId of orderIds) {
      try {
        await this.sweepOrder(orderId);
      } catch (err) {
        this.logger.error(
          `Sweep failed for order ${orderId}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async sweepOrder(orderId: string): Promise<void> {
    const queue = await this.getQueue(orderId);
    if (!queue) {
      // Stale membership (queue already deleted/expired) — clean it up.
      await this.redis.srem(MatchingService.ACTIVE_SET_KEY, orderId);
      return;
    }

    const now = Date.now();

    if (now >= queue.noDriverDeadline) {
      await this.handleNoDriversFound(orderId, queue.passengerId);
      return;
    }

    const hasActiveOffer =
      queue.drivers.length > 0 && queue.currentIndex < queue.drivers.length;

    if (hasActiveOffer) {
      if (now >= queue.offerExpiresAt) {
        const currentDriver = queue.drivers[queue.currentIndex];
        await this.offerTimeout(currentDriver.userId, orderId);
      }
      return;
    }

    // No offer outstanding and the deadline hasn't passed: look again. This is
    // what makes "will retry" true — a driver who came online after the
    // initial search, or after everyone in the first batch declined, gets
    // offered the ride instead of the passenger waiting out the full window
    // for a cancellation.
    await this.researchDrivers(queue);
  }

  /**
   * Re-runs the nearby-driver search for a queue with no outstanding offer and
   * offers the ride to the closest driver who hasn't already refused it.
   */
  private async researchDrivers(queue: DriverQueue): Promise<void> {
    const candidates = await this.driversService.getNearbyDrivers(
      queue.pickupLat,
      queue.pickupLng,
      3,
      queue.tariffTier,
    );

    const fresh = candidates.filter(
      (driver) => !queue.exhaustedDriverIds.includes(driver.userId),
    );

    if (fresh.length === 0) {
      return;
    }

    this.logger.log(
      `Re-search found ${fresh.length} new driver(s) for order ${queue.orderId}`,
    );

    const nextBatch = fresh.slice(0, 3);
    const refreshed: DriverQueue = {
      ...queue,
      drivers: nextBatch,
      currentIndex: 0,
    };

    await this.offerToDriver(queue.orderId, nextBatch[0], refreshed);
  }

  private async offerToDriver(
    orderId: string,
    driver: NearbyDriver,
    queue: DriverQueue,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order) return;

    // Check order is still in SEARCHING state
    if (order.status !== OrderStatus.SEARCHING) {
      await this.deleteQueue(orderId);
      return;
    }

    const driverUser = await this.usersService.findById(driver.userId);

    if (!driverUser) return;

    // Pickup/dropoff are opaque PostGIS geometry columns on the entity — the
    // mobile client's shared Order model expects plain {address, lat, lng},
    // same shape OrdersService.attachDisplayFields attaches on REST responses.
    const coordsResult = await this.orderRepository.query(
      `SELECT ST_Y(pickup_location::geometry) as pickup_lat,
              ST_X(pickup_location::geometry) as pickup_lng,
              ST_Y(dropoff_location::geometry) as dropoff_lat,
              ST_X(dropoff_location::geometry) as dropoff_lng
       FROM orders WHERE id = $1`,
      [orderId],
    );
    const coords = (coordsResult as Array<{
      pickup_lat: string;
      pickup_lng: string;
      dropoff_lat: string;
      dropoff_lng: string;
    }>)[0];

    // Emit to driver via WebSocket, shaped to match the mobile Order model
    // (Order.fromJson) directly rather than a bespoke offer-only shape.
    this.realtimeGateway.emitToUser(driver.userId, 'new_order_offer', {
      id: order.id,
      passengerId: order.passengerId,
      pickup: {
        address: order.pickupAddress,
        lat: parseFloat(coords.pickup_lat),
        lng: parseFloat(coords.pickup_lng),
      },
      dropoff: {
        address: order.dropoffAddress,
        lat: parseFloat(coords.dropoff_lat),
        lng: parseFloat(coords.dropoff_lng),
      },
      status: order.status,
      estimatedPrice: order.estimatedPrice,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      distanceKm: driver.distanceKm,
      timeoutSeconds: this.OFFER_TIMEOUT_MS / 1000,
    });

    // Send push notification
    await this.notificationsService.notifyNewOrderOffer(driverUser, order);

    queue.offerExpiresAt = Date.now() + this.OFFER_TIMEOUT_MS;
    await this.saveQueue(queue);

    this.logger.log(
      `Order offer sent to driver ${driver.userId} (${driver.distanceKm.toFixed(2)}km away)`,
    );
  }

  private async handleNoDriversFound(orderId: string, passengerId: string): Promise<void> {
    await this.deleteQueue(orderId);

    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order || order.status !== OrderStatus.SEARCHING) return;

    // Cancel the order
    await this.orderRepository.update(orderId, {
      status: OrderStatus.CANCELLED,
      cancelReason: 'No drivers available',
    });

    // Notify passenger
    this.realtimeGateway.emitToUser(passengerId, 'no_drivers_found', {
      orderId,
      message: 'No drivers available in your area. Please try again later.',
    });

    this.logger.log(`Order ${orderId} cancelled — no drivers found`);
  }

  private queueKey(orderId: string): string {
    return `matching:queue:${orderId}`;
  }

  private async saveQueue(queue: DriverQueue): Promise<void> {
    await this.redis.set(
      this.queueKey(queue.orderId),
      JSON.stringify(queue),
      'EX',
      MatchingService.QUEUE_TTL_SECONDS,
    );
    await this.redis.sadd(MatchingService.ACTIVE_SET_KEY, queue.orderId);
  }

  private async getQueue(orderId: string): Promise<DriverQueue | null> {
    const raw = await this.redis.get(this.queueKey(orderId));
    return raw ? (JSON.parse(raw) as DriverQueue) : null;
  }

  private async deleteQueue(orderId: string): Promise<void> {
    await this.redis.del(this.queueKey(orderId));
    await this.redis.srem(MatchingService.ACTIVE_SET_KEY, orderId);
  }
}
