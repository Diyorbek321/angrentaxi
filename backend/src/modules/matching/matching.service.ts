import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { DriversService, NearbyDriver } from '../drivers/drivers.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

interface DriverQueue {
  orderId: string;
  drivers: NearbyDriver[];
  currentIndex: number;
  passengerId: string;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);
  private readonly driverQueues = new Map<string, DriverQueue>();
  private readonly OFFER_TIMEOUT_MS = 15000; // 15 seconds per driver
  private readonly NO_DRIVER_TIMEOUT_MS = 60000; // 60 seconds total

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly driversService: DriversService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly schedulerRegistry: SchedulerRegistry,
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

    // Find nearby drivers (3km radius)
    const nearbyDrivers = await this.driversService.getNearbyDrivers(lat, lng, 3);

    if (nearbyDrivers.length === 0) {
      this.logger.log(`No drivers found near order ${orderId}, will retry...`);

      // Set no-driver timeout
      const timeoutId = setTimeout(async () => {
        await this.handleNoDriversFound(orderId, order.passengerId);
      }, this.NO_DRIVER_TIMEOUT_MS);

      this.schedulerRegistry.addTimeout(`no-driver:${orderId}`, timeoutId);
      return;
    }

    this.logger.log(`Found ${nearbyDrivers.length} nearby drivers for order ${orderId}`);

    // Take nearest 3 drivers
    const topDrivers = nearbyDrivers.slice(0, 3);

    const queue: DriverQueue = {
      orderId,
      drivers: topDrivers,
      currentIndex: 0,
      passengerId: order.passengerId,
    };

    this.driverQueues.set(orderId, queue);

    // Offer to first driver
    await this.offerToDriver(orderId, topDrivers[0]);

    // Set overall no-driver timeout
    const fallbackTimeout = setTimeout(async () => {
      await this.handleNoDriversFound(orderId, order.passengerId);
    }, this.NO_DRIVER_TIMEOUT_MS);

    this.schedulerRegistry.addTimeout(`no-driver:${orderId}`, fallbackTimeout);
  }

  async driverAccepted(driverId: string, orderId: string): Promise<void> {
    // Clear timers
    this.clearOrderTimers(orderId);
    this.driverQueues.delete(orderId);

    this.logger.log(`Driver ${driverId} accepted order ${orderId}`);
  }

  async driverDeclined(driverId: string, orderId: string): Promise<void> {
    this.logger.log(`Driver ${driverId} declined order ${orderId}`);

    // Clear current offer timer
    this.clearOfferTimer(orderId, driverId);

    const queue = this.driverQueues.get(orderId);
    if (!queue) return;

    queue.currentIndex += 1;

    if (queue.currentIndex >= queue.drivers.length) {
      await this.handleNoDriversFound(orderId, queue.passengerId);
      return;
    }

    const nextDriver = queue.drivers[queue.currentIndex];
    await this.offerToDriver(orderId, nextDriver);
  }

  async offerTimeout(driverId: string, orderId: string): Promise<void> {
    this.logger.log(`Offer to driver ${driverId} for order ${orderId} timed out`);
    await this.driverDeclined(driverId, orderId);
  }

  private async offerToDriver(orderId: string, driver: NearbyDriver): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order) return;

    // Check order is still in SEARCHING state
    if (order.status !== OrderStatus.SEARCHING) {
      this.driverQueues.delete(orderId);
      return;
    }

    const driverUser = await this.usersService.findById(driver.userId);

    if (!driverUser) return;

    // Emit to driver via WebSocket
    this.realtimeGateway.emitToUser(driver.userId, 'new_order_offer', {
      orderId,
      order: {
        id: order.id,
        pickupAddress: order.pickupAddress,
        dropoffAddress: order.dropoffAddress,
        estimatedPrice: order.estimatedPrice,
        paymentMethod: order.paymentMethod,
        distanceKm: driver.distanceKm,
      },
      timeoutSeconds: this.OFFER_TIMEOUT_MS / 1000,
    });

    // Send push notification
    await this.notificationsService.notifyNewOrderOffer(driverUser, order);

    // Set per-driver offer timeout
    const timeoutId = setTimeout(async () => {
      await this.offerTimeout(driver.userId, orderId);
    }, this.OFFER_TIMEOUT_MS);

    this.schedulerRegistry.addTimeout(`offer:${orderId}:${driver.userId}`, timeoutId);

    this.logger.log(
      `Order offer sent to driver ${driver.userId} (${driver.distanceKm.toFixed(2)}km away)`,
    );
  }

  private async handleNoDriversFound(orderId: string, passengerId: string): Promise<void> {
    this.clearOrderTimers(orderId);
    this.driverQueues.delete(orderId);

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

  private clearOfferTimer(orderId: string, driverId: string): void {
    const timerName = `offer:${orderId}:${driverId}`;
    try {
      this.schedulerRegistry.deleteTimeout(timerName);
    } catch (_) {
      // Timer may not exist, ignore
    }
  }

  private clearOrderTimers(orderId: string): void {
    // Clear no-driver fallback timer
    try {
      this.schedulerRegistry.deleteTimeout(`no-driver:${orderId}`);
    } catch (_) {
      // ignore
    }

    // Clear any pending offer timers
    const queue = this.driverQueues.get(orderId);
    if (queue) {
      const currentDriver = queue.drivers[queue.currentIndex];
      if (currentDriver) {
        this.clearOfferTimer(orderId, currentDriver.userId);
      }
    }
  }
}
