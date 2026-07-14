import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Order, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import { Trip } from '../../database/entities/trip.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { TariffsService } from '../tariffs/tariffs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { DriversService } from '../drivers/drivers.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { DriverBonusesService } from '../driver-bonuses/driver-bonuses.service';
import { SettingsService } from '../settings/settings.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateDispatchOrderDto } from './dto/create-dispatch-order.dto';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { UserRole } from '../../database/entities/user.entity';

export interface PaginatedOrders {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}

export interface DriverEarningsPeriod {
  gross: number;
  commission: number;
  net: number;
  trips: number;
}

export interface DriverEarningsBreakdown {
  today: DriverEarningsPeriod;
  week: DriverEarningsPeriod;
  month: DriverEarningsPeriod;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly tariffsService: TariffsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly driversService: DriversService,
    private readonly promoCodesService: PromoCodesService,
    private readonly driverBonusesService: DriverBonusesService,
    private readonly settingsService: SettingsService,
  ) {}

  async calculatePrice(
    dto: CalculatePriceDto,
  ): Promise<{ price: number; tariffId: string; distanceKm: number; durationMin: number }> {
    const price = await this.tariffsService.calculatePriceByTariffId(
      dto.tariffId,
      dto.distanceKm,
      dto.durationMin,
    );

    return {
      price,
      tariffId: dto.tariffId,
      distanceKm: dto.distanceKm,
      durationMin: dto.durationMin,
    };
  }

  async create(passengerId: string, dto: CreateOrderDto): Promise<Order> {
    const tariff = await this.tariffsService.findById(dto.tariffId);

    if (!tariff.isActive) {
      throw new BadRequestException('Selected tariff is not available');
    }

    // Estimate distance using Haversine formula (frontend should provide actual distance).
    // For multi-stop rides, sum the Haversine legs across the full path:
    // pickup -> waypoint[0] -> ... -> waypoint[n-1] -> dropoff.
    const estimatedDistanceKm = dto.waypoints?.length
      ? this.haversineRouteDistance(
          [
            { lat: dto.pickupLat, lng: dto.pickupLng },
            ...dto.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
            { lat: dto.dropoffLat, lng: dto.dropoffLng },
          ],
        )
      : this.haversineDistance(
          dto.pickupLat,
          dto.pickupLng,
          dto.dropoffLat,
          dto.dropoffLng,
        );

    const estimatedDurationMin = Math.ceil(estimatedDistanceKm * 2.5); // rough estimate

    const estimatedPrice = this.tariffsService.calculatePrice(
      tariff,
      estimatedDistanceKm,
      estimatedDurationMin,
    );

    // Validate (but don't yet consume) a promo code — usedCount/usage row are
    // only recorded on actual trip completion (see completeTrip), so an
    // abandoned/cancelled order never burns the passenger's one-time use.
    let discountAmount = 0;
    let promoCodeId: string | null = null;
    if (dto.promoCode) {
      const promoResult = await this.promoCodesService.validate(
        dto.promoCode,
        passengerId,
        estimatedPrice,
      );
      discountAmount = promoResult.discountAmount;
      promoCodeId = promoResult.promoCodeId;
    }
    const finalEstimatedPrice = Math.max(0, estimatedPrice - discountAmount);

    // Create order with PostGIS geometry
    const savedOrder = await this.orderRepository.query(
      `INSERT INTO orders (passenger_id, tariff_id, pickup_location, dropoff_location,
        pickup_address, dropoff_address, estimated_price, status, payment_method, note,
        service_type, details, promo_code_id, discount_amount, waypoints)
       VALUES ($1, $2,
         ST_SetSRID(ST_MakePoint($3, $4), 4326),
         ST_SetSRID(ST_MakePoint($5, $6), 4326),
         $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17::jsonb)
       RETURNING id`,
      [
        passengerId,
        dto.tariffId,
        dto.pickupLng,
        dto.pickupLat,
        dto.dropoffLng,
        dto.dropoffLat,
        dto.pickupAddress ?? null,
        dto.dropoffAddress ?? null,
        finalEstimatedPrice,
        OrderStatus.CREATED,
        dto.paymentMethod ?? PaymentMethod.CASH,
        dto.note ?? null,
        dto.serviceType ?? 'taxi',
        dto.details ? JSON.stringify(dto.details) : null,
        promoCodeId,
        promoCodeId ? discountAmount : null,
        dto.waypoints?.length ? JSON.stringify(dto.waypoints) : null,
      ],
    );

    const orderId = (savedOrder as Array<{ id: string }>)[0].id;
    const order = await this.findByIdOrThrow(orderId);

    // Notify passenger order was created
    this.realtimeGateway.emitToUser(passengerId, 'order:created', {
      orderId,
      status: OrderStatus.CREATED,
    });

    // Let dispatchers see the new order on the live board immediately
    this.realtimeGateway.emitToManagers('order:created', order);

    // Start driver matching asynchronously
    // Note: matching module will be injected via forward reference to avoid circular deps
    this.logger.log(`Order ${orderId} created, starting driver search...`);

    return order;
  }

  // Manager/admin manual order entry — resolves (or creates) the passenger by
  // phone, then reuses the normal create() flow so matching kicks off the same way.
  async createForDispatch(dto: CreateDispatchOrderDto): Promise<Order> {
    const passenger = await this.usersService.findOrCreateByPhone(
      dto.passengerPhone,
      dto.passengerName,
    );

    return this.create(passenger.id, {
      tariffId: dto.tariffId,
      pickupLat: dto.pickupLat,
      pickupLng: dto.pickupLng,
      dropoffLat: dto.dropoffLat,
      dropoffLng: dto.dropoffLng,
      pickupAddress: dto.pickupAddress,
      dropoffAddress: dto.dropoffAddress,
      paymentMethod: dto.paymentMethod,
      note: dto.note,
    });
  }

  async acceptOrder(driverId: string, orderId: string): Promise<Order> {
    const order = await this.findByIdOrThrow(orderId);

    if (order.status !== OrderStatus.SEARCHING) {
      throw new BadRequestException(
        `Cannot accept order with status ${order.status}`,
      );
    }

    if (order.driverId) {
      throw new BadRequestException('Order already has a driver');
    }

    await this.updateOrderStatusAtomic(orderId, OrderStatus.SEARCHING, {
      driverId,
      status: OrderStatus.ACCEPTED,
    });

    const updatedOrder = await this.findByIdOrThrow(orderId);

    // Notify passenger
    const passenger = await this.usersService.findById(order.passengerId);
    const driver = await this.driversService.findByUserId(driverId);

    if (passenger && driver) {
      // Emit via WebSocket
      this.realtimeGateway.emitToUser(order.passengerId, 'order:accepted', {
        orderId,
        driverId,
        driver: {
          id: driver.id,
          userId: driver.userId,
          carModel: driver.carModel,
          carNumber: driver.carNumber,
          rating: driver.rating,
        },
      });

      // Send push notification
      await this.notificationsService.notifyOrderAccepted(passenger, driver, updatedOrder);
    }

    this.realtimeGateway.emitToManagers('order:updated', updatedOrder);
    if (driver) {
      this.realtimeGateway.emitToManagers('driver:status_changed', {
        driverId: driver.id,
        status: 'busy',
      });
    }

    return updatedOrder;
  }

  async driverArrived(driverId: string, orderId: string): Promise<Order> {
    const order = await this.findByIdOrThrow(orderId);

    if (order.status !== OrderStatus.ACCEPTED) {
      throw new BadRequestException(
        `Cannot mark arrived for order with status ${order.status}`,
      );
    }

    if (order.driverId !== driverId) {
      throw new ForbiddenException('You are not the driver for this order');
    }

    // Geofence check — driver must be within 500m of pickup
    const geofenceCheck = await this.orderRepository.query(
      `SELECT ST_Distance(
        ST_SetSRID(
          (SELECT current_location::geometry FROM drivers WHERE user_id = $1),
          4326
        )::geography,
        (SELECT pickup_location::geometry FROM orders WHERE id = $2)::geography
      ) as distance_meters`,
      [driverId, orderId],
    );

    // NOTE: was `?? '9999'` written as `|| '9999'` — pg returns ST_Distance's
    // result as a JS number, and a driver standing exactly on the pickup point
    // (distance 0) is falsy, so `||` incorrectly fell back to the 9999m sentinel
    // and rejected a driver who was precisely at the pickup location.
    const rawDistance = (geofenceCheck as Array<{ distance_meters: number | string | null }>)[0]
      ?.distance_meters;
    const distanceMeters = rawDistance != null ? parseFloat(String(rawDistance)) : 9999;

    if (distanceMeters > 500) {
      this.logger.warn(
        `Driver ${driverId} is ${distanceMeters.toFixed(0)}m away from pickup, rejecting arrived status`,
      );
      throw new BadRequestException(
        `You must be within 500m of the pickup location (currently ${distanceMeters.toFixed(0)}m away)`,
      );
    }

    await this.updateOrderStatusAtomic(orderId, OrderStatus.ACCEPTED, {
      status: OrderStatus.ARRIVED,
    });

    const updatedOrder = await this.findByIdOrThrow(orderId);

    // Notify passenger
    const passenger = await this.usersService.findById(order.passengerId);

    if (passenger) {
      this.realtimeGateway.emitToUser(order.passengerId, 'order:arrived', {
        orderId,
        message: 'Your driver has arrived',
      });

      await this.notificationsService.notifyDriverArrived(passenger, updatedOrder);
    }

    this.realtimeGateway.emitToManagers('order:updated', updatedOrder);

    return updatedOrder;
  }

  async startTrip(driverId: string, orderId: string): Promise<Order> {
    const order = await this.findByIdOrThrow(orderId);

    if (order.status !== OrderStatus.ARRIVED) {
      throw new BadRequestException(
        `Cannot start trip for order with status ${order.status}`,
      );
    }

    if (order.driverId !== driverId) {
      throw new ForbiddenException('You are not the driver for this order');
    }

    await this.updateOrderStatusAtomic(orderId, OrderStatus.ARRIVED, {
      status: OrderStatus.IN_PROGRESS,
    });

    // Create Trip record
    await this.tripRepository.save({
      orderId,
      startTime: new Date(),
      endTime: null,
      actualDistanceKm: null,
      actualDurationMin: null,
    });

    const updatedOrder = await this.findByIdOrThrow(orderId);

    // Notify passenger
    this.realtimeGateway.emitToUser(order.passengerId, 'order:in_progress', {
      orderId,
      message: 'Trip started',
    });

    this.realtimeGateway.emitToManagers('order:updated', updatedOrder);

    return updatedOrder;
  }

  async completeTrip(driverId: string, orderId: string): Promise<Order> {
    const order = await this.findByIdOrThrow(orderId);

    if (order.status !== OrderStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot complete order with status ${order.status}`,
      );
    }

    if (order.driverId !== driverId) {
      throw new ForbiddenException('You are not the driver for this order');
    }

    // Get trip record
    const trip = await this.tripRepository.findOne({ where: { orderId } });

    const now = new Date();
    let actualDurationMin = 0;
    let actualDistanceKm = 0;

    if (trip?.startTime) {
      actualDurationMin = Math.ceil(
        (now.getTime() - trip.startTime.getTime()) / (1000 * 60),
      );
    }

    // Compute actual distance using PostGIS straight-line distance as fallback
    const distResult = await this.orderRepository.query(
      `SELECT ST_Distance(pickup_location::geography, dropoff_location::geography) as distance_meters FROM orders WHERE id = $1`,
      [orderId],
    );

    actualDistanceKm =
      parseFloat((distResult as Array<{ distance_meters: string }>)[0]?.distance_meters || '0') /
      1000;

    // Compute final price
    const tariff = await this.tariffsService.findById(order.tariffId);
    const finalPrice = this.tariffsService.calculatePrice(
      tariff,
      actualDistanceKm,
      actualDurationMin,
    );

    // Update trip
    if (trip) {
      await this.tripRepository.update(trip.id, {
        endTime: now,
        actualDistanceKm,
        actualDurationMin,
      });
    }

    // Re-apply the promo discount against the final amount (may differ from the
    // original estimate since it's recomputed from actual distance/duration), and
    // only now record actual usage — a cancelled trip never consumed the promo.
    let finalDiscountAmount = 0;
    if (order.promoCodeId) {
      try {
        const promoCode = await this.promoCodesService.findById(order.promoCodeId);
        const promoResult = await this.promoCodesService.validate(
          promoCode.code,
          order.passengerId,
          finalPrice,
        );
        finalDiscountAmount = promoResult.discountAmount;
        await this.promoCodesService.apply(order.promoCodeId, order.passengerId, orderId);
      } catch (err) {
        // Promo became invalid between order creation and completion (expired,
        // limit hit by a concurrent order) — degrade gracefully to full price
        // rather than failing trip completion.
        this.logger.warn(
          `Promo code re-validation failed at completion for order ${orderId}, charging full price: ${err}`,
        );
      }
    }
    const discountedFinalPrice = Math.max(0, finalPrice - finalDiscountAmount);

    // Commission: driver's own override rate if set, else the platform default.
    const payoutDriver = order.driverId
      ? await this.driversService.findByUserId(order.driverId)
      : null;
    const commissionRate =
      payoutDriver?.commissionRate ?? (await this.settingsService.getDefaultCommissionRate());
    const commissionAmount = Math.round((discountedFinalPrice * commissionRate) / 100);
    const netDriverEarning = discountedFinalPrice - commissionAmount;

    // Update order
    await this.orderRepository.update(orderId, {
      status: OrderStatus.COMPLETED,
      finalPrice: discountedFinalPrice,
      discountAmount: finalDiscountAmount || null,
      driverEarning: netDriverEarning,
    });

    // Create transaction record (passenger charge)
    await this.transactionRepository.save({
      userId: order.passengerId,
      orderId,
      amount: discountedFinalPrice,
      type: TransactionType.DEBIT,
      paymentMethod: order.paymentMethod,
      status: order.paymentMethod === PaymentMethod.CASH
        ? TransactionStatus.COMPLETED
        : TransactionStatus.PENDING,
      externalId: null,
    });

    // Driver payout: gross CREDIT for the fare, then a DEBIT for the platform's
    // commission share — the ledger records both legs rather than only the net.
    if (order.driverId && payoutDriver) {
      await this.transactionRepository.save({
        userId: order.driverId,
        orderId,
        amount: discountedFinalPrice,
        type: TransactionType.CREDIT,
        paymentMethod: order.paymentMethod,
        status: TransactionStatus.COMPLETED,
        externalId: null,
      });

      if (commissionAmount > 0) {
        await this.transactionRepository.save({
          userId: order.driverId,
          orderId,
          amount: commissionAmount,
          type: TransactionType.DEBIT,
          paymentMethod: order.paymentMethod,
          status: TransactionStatus.COMPLETED,
          externalId: 'commission',
        });
      }

      // For a CASH trip the driver already pocketed the fare directly from the
      // passenger — the app never held that money, so only the commission owed
      // to the platform hits the wallet (balance trends negative over time,
      // which is the point: it's what the driver must eventually top up). For
      // CARD/WALLET trips the platform holds the funds, so the wallet is
      // credited the net payout the platform still owes the driver.
      const balanceDelta =
        order.paymentMethod === PaymentMethod.CASH ? -commissionAmount : netDriverEarning;
      await this.driversService.adjustBalance(order.driverId, balanceDelta);

      // Best-effort — a bonus-evaluation failure must never block trip completion.
      this.driverBonusesService.evaluateForDriver(order.driverId).catch((err) => {
        this.logger.error(`Bonus evaluation failed for driver ${order.driverId}: ${err}`);
      });
    }

    const updatedOrder = await this.findByIdOrThrow(orderId);

    // Notify passenger
    const passenger = await this.usersService.findById(order.passengerId);

    if (passenger) {
      this.realtimeGateway.emitToUser(order.passengerId, 'order:completed', {
        orderId,
        finalPrice: discountedFinalPrice,
        actualDistanceKm,
        actualDurationMin,
      });

      await this.notificationsService.notifyTripCompleted(passenger, discountedFinalPrice, updatedOrder);
    }

    this.realtimeGateway.emitToManagers('order:completed', updatedOrder);

    // Re-fetch: adjustBalance may have just flipped isOnline to false if the
    // commission deduction pushed the driver negative.
    const finishedDriver = await this.driversService.findByUserId(driverId);
    if (finishedDriver) {
      if (finishedDriver.isOnline) {
        this.realtimeGateway.emitToManagers('driver:status_changed', {
          driverId: finishedDriver.id,
          status: 'online',
        });
      } else {
        this.realtimeGateway.emitToManagers('driver:offline', { driverId: finishedDriver.id });
      }
    }

    this.logger.log(
      `Order ${orderId} completed. Distance: ${actualDistanceKm.toFixed(2)}km, Price: ${discountedFinalPrice} UZS`,
    );

    return updatedOrder;
  }

  async reassignDriver(orderId: string, newDriverProfileId: string): Promise<Order> {
    const order = await this.findByIdOrThrow(orderId);

    const reassignableStatuses: OrderStatus[] = [
      OrderStatus.CREATED,
      OrderStatus.SEARCHING,
      OrderStatus.ACCEPTED,
      OrderStatus.ARRIVED,
    ];

    if (!reassignableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot assign a driver to order with status ${order.status}`,
      );
    }

    const newDriver = await this.driversService.findByIdOrThrow(newDriverProfileId);

    if (!newDriver.isOnline) {
      throw new BadRequestException('Selected driver is not online');
    }

    if (order.driverId === newDriver.userId) {
      throw new BadRequestException('Order is already assigned to this driver');
    }

    const previousDriverId = order.driverId;

    await this.updateOrderStatusAtomic(orderId, reassignableStatuses, {
      driverId: newDriver.userId,
      status: OrderStatus.ACCEPTED,
    });

    const updatedOrder = await this.findByIdOrThrow(orderId);

    // The previous driver (if any) loses this order — reuse the cancellation
    // event so the driver app's existing handler dismisses it immediately.
    if (previousDriverId) {
      this.realtimeGateway.emitToUser(previousDriverId, 'order:cancelled', {
        orderId,
        reason: 'Reassigned to another driver',
        cancelledBy: UserRole.MANAGER,
      });
    }

    this.realtimeGateway.emitToUser(newDriver.userId, 'order:accepted', {
      orderId,
      driverId: newDriver.userId,
      driver: {
        id: newDriver.id,
        userId: newDriver.userId,
        carModel: newDriver.carModel,
        carNumber: newDriver.carNumber,
        rating: newDriver.rating,
      },
    });

    const passenger = await this.usersService.findById(order.passengerId);
    if (passenger) {
      this.realtimeGateway.emitToUser(order.passengerId, 'order:accepted', {
        orderId,
        driverId: newDriver.userId,
        driver: {
          id: newDriver.id,
          userId: newDriver.userId,
          carModel: newDriver.carModel,
          carNumber: newDriver.carNumber,
          rating: newDriver.rating,
        },
      });
      await this.notificationsService.notifyOrderAccepted(passenger, newDriver, updatedOrder);
    }

    this.realtimeGateway.emitToManagers('order:updated', updatedOrder);
    this.realtimeGateway.emitToManagers('driver:status_changed', {
      driverId: newDriver.id,
      status: 'busy',
    });

    if (previousDriverId) {
      const previousDriver = await this.driversService.findByUserId(previousDriverId);
      if (previousDriver) {
        this.realtimeGateway.emitToManagers('driver:status_changed', {
          driverId: previousDriver.id,
          status: 'online',
        });
      }
    }

    this.logger.log(
      `Order ${orderId} reassigned from driver ${previousDriverId ?? 'none'} to ${newDriver.userId}`,
    );

    return updatedOrder;
  }

  async cancelOrder(
    userId: string,
    userRole: UserRole,
    orderId: string,
    reason?: string,
  ): Promise<Order> {
    const order = await this.findByIdOrThrow(orderId);

    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.CREATED,
      OrderStatus.SEARCHING,
      OrderStatus.ACCEPTED,
      OrderStatus.ARRIVED,
    ];

    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel order with status ${order.status}`,
      );
    }

    // Permission check: passenger can cancel their own, driver can cancel their assigned order
    const isPassenger = userRole === UserRole.PASSENGER && order.passengerId === userId;
    const isDriver = userRole === UserRole.DRIVER && order.driverId === userId;
    const isManagerOrAdmin =
      userRole === UserRole.MANAGER || userRole === UserRole.ADMIN;

    if (!isPassenger && !isDriver && !isManagerOrAdmin) {
      throw new ForbiddenException('You are not authorized to cancel this order');
    }

    await this.updateOrderStatusAtomic(orderId, cancellableStatuses, {
      status: OrderStatus.CANCELLED,
      cancelReason: reason ?? null,
    });

    const updatedOrder = await this.findByIdOrThrow(orderId);

    // Notify both parties
    if (order.passengerId !== userId) {
      const passenger = await this.usersService.findById(order.passengerId);
      if (passenger) {
        this.realtimeGateway.emitToUser(order.passengerId, 'order:cancelled', {
          orderId,
          reason,
          cancelledBy: userRole,
        });
        await this.notificationsService.notifyOrderCancelled(passenger, updatedOrder, reason);
      }
    }

    if (order.driverId && order.driverId !== userId) {
      const driver = await this.usersService.findById(order.driverId);
      if (driver) {
        this.realtimeGateway.emitToUser(order.driverId, 'order:cancelled', {
          orderId,
          reason,
          cancelledBy: userRole,
        });
        await this.notificationsService.notifyOrderCancelled(driver, updatedOrder, reason);
      }
    }

    this.realtimeGateway.emitToManagers('order:cancelled', updatedOrder);

    if (order.driverId) {
      const freedDriver = await this.driversService.findByUserId(order.driverId);
      if (freedDriver) {
        this.realtimeGateway.emitToManagers('driver:status_changed', {
          driverId: freedDriver.id,
          status: 'online',
        });
      }
    }

    return updatedOrder;
  }

  async getPassengerHistory(
    passengerId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedOrders> {
    const [orders, total] = await this.orderRepository.findAndCount({
      where: { passengerId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['passenger', 'driver', 'tariff'],
    });

    return { orders: await this.attachDisplayFields(orders), total, page, limit };
  }

  async getDriverHistory(
    driverId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedOrders> {
    const [orders, total] = await this.orderRepository.findAndCount({
      where: { driverId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['passenger', 'driver', 'tariff'],
    });

    return { orders: await this.attachDisplayFields(orders), total, page, limit };
  }

  async getActiveOrders(): Promise<Order[]> {
    const orders = await this.orderRepository.find({
      where: [
        { status: OrderStatus.SEARCHING },
        { status: OrderStatus.ACCEPTED },
        { status: OrderStatus.ARRIVED },
        { status: OrderStatus.IN_PROGRESS },
      ],
      order: { createdAt: 'DESC' },
      relations: ['passenger', 'driver', 'tariff'],
    });
    return this.attachDisplayFields(orders);
  }

  async findByIdOrThrow(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['passenger', 'driver', 'tariff'],
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    const [enriched] = await this.attachDisplayFields([order]);
    return enriched;
  }

  /**
   * Atomically applies a status transition, guarding the write with a
   * `WHERE id = :id AND status IN (:...expectedStatuses)` clause so the
   * update only lands if the order is still in a state the caller already
   * validated. This closes the TOCTOU race where two concurrent requests
   * (e.g. two drivers accepting the same order) both pass the in-app status
   * check before either write lands — only the first conditional update
   * affects a row; the second affects zero rows and must be rejected rather
   * than silently overwriting the first.
   *
   * Throws ConflictException if no row matched (order was already moved to
   * a different status by a concurrent request).
   */
  private async updateOrderStatusAtomic(
    orderId: string,
    expectedStatus: OrderStatus | OrderStatus[],
    updateData: QueryDeepPartialEntity<Order>,
  ): Promise<void> {
    const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];

    const result = await this.orderRepository
      .createQueryBuilder()
      .update(Order)
      .set(updateData)
      .where('id = :id', { id: orderId })
      .andWhere('status IN (:...expectedStatuses)', { expectedStatuses })
      .execute();

    if (!result.affected) {
      throw new ConflictException('Order is no longer in the expected state');
    }
  }

  async getAllOrders(
    page: number = 1,
    limit: number = 20,
    status?: string,
  ): Promise<PaginatedOrders> {
    const where = status ? { status: status as OrderStatus } : {};
    const [orders, total] = await this.orderRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['passenger', 'driver', 'tariff'],
    });
    return { orders: await this.attachDisplayFields(orders), total, page, limit };
  }

  // The `passenger`/`driver` relations only carry raw User columns (firstName/
  // lastName, no car info or rating — that lives on the separate Driver profile
  // table). The web panels expect a flattened `name` plus the driver's car/rating,
  // so we merge that in here rather than pushing this shape decision into every caller.
  // Also attaches `pickup`/`dropoff` as {address, lat, lng} — the raw pickupLocation/
  // dropoffLocation columns are opaque PostGIS geometry values when read through the
  // ORM (not plain lat/lng), so mobile clients need this extracted for them here.
  private async attachDisplayFields(orders: Order[]): Promise<Order[]> {
    const driverUserIds = [...new Set(orders.map((o) => o.driverId).filter((id): id is string => !!id))];

    const driverProfiles = await Promise.all(
      driverUserIds.map((userId) => this.driversService.findByUserId(userId)),
    );
    const profileByUserId = new Map(
      driverProfiles
        .filter((d): d is NonNullable<typeof d> => !!d)
        .map((d) => [d.userId, d]),
    );

    const orderIds = orders.map((o) => o.id);
    const coordsByOrderId = new Map<
      string,
      { pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number }
    >();

    if (orderIds.length > 0) {
      const coordsResult = await this.orderRepository.query(
        `SELECT id,
                ST_Y(pickup_location::geometry) as pickup_lat,
                ST_X(pickup_location::geometry) as pickup_lng,
                ST_Y(dropoff_location::geometry) as dropoff_lat,
                ST_X(dropoff_location::geometry) as dropoff_lng
         FROM orders WHERE id = ANY($1)`,
        [orderIds],
      );

      for (const row of coordsResult as Array<{
        id: string;
        pickup_lat: string;
        pickup_lng: string;
        dropoff_lat: string;
        dropoff_lng: string;
      }>) {
        coordsByOrderId.set(row.id, {
          pickupLat: parseFloat(row.pickup_lat),
          pickupLng: parseFloat(row.pickup_lng),
          dropoffLat: parseFloat(row.dropoff_lat),
          dropoffLng: parseFloat(row.dropoff_lng),
        });
      }
    }

    for (const order of orders) {
      if (order.passenger) {
        const passenger = order.passenger as unknown as Record<string, unknown>;
        passenger.name =
          [order.passenger.firstName, order.passenger.lastName].filter(Boolean).join(' ').trim() ||
          'Passenger';
      }

      if (order.driver) {
        const profile = order.driverId ? profileByUserId.get(order.driverId) : undefined;
        const driver = order.driver as unknown as Record<string, unknown>;
        driver.name =
          [order.driver.firstName, order.driver.lastName].filter(Boolean).join(' ').trim() || 'Driver';
        driver.carModel = profile?.carModel ?? null;
        driver.carNumber = profile?.carNumber ?? null;
        driver.rating = profile?.rating ?? 0;
      }

      const coords = coordsByOrderId.get(order.id);
      const orderRecord = order as unknown as Record<string, unknown>;
      orderRecord.pickup = {
        address: order.pickupAddress,
        lat: coords?.pickupLat ?? null,
        lng: coords?.pickupLng ?? null,
      };
      orderRecord.dropoff = {
        address: order.dropoffAddress,
        lat: coords?.dropoffLat ?? null,
        lng: coords?.dropoffLng ?? null,
      };
      orderRecord.waypoints = order.waypoints ?? [];
    }

    return orders;
  }

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      ordersToday,
      completedToday,
      totalUsers,
      activeDrivers,
      onlineDrivers,
      pendingDriverApprovals,
    ] = await Promise.all([
      this.orderRepository.count(),
      // Was comparing createdAt to exact midnight (an equality match that never
      // hits a real timestamp) — always returned 0. Needs a >= range instead.
      this.orderRepository
        .createQueryBuilder('o')
        .where('o.created_at >= :d', { d: today })
        .getCount(),
      this.orderRepository.createQueryBuilder('o')
        .where('o.status = :s', { s: 'completed' })
        .andWhere('o.created_at >= :d', { d: today })
        .getCount(),
      this.orderRepository.manager.getRepository('users').count(),
      this.driversService.countAll(),
      this.driversService.countOnline(),
      this.driversService.countPending(),
    ]);

    const revenueResult = await this.orderRepository.createQueryBuilder('o')
      .select('SUM(o.final_price)', 'total')
      .where('o.status = :s', { s: 'completed' })
      .andWhere('o.created_at >= :d', { d: today })
      .getRawOne<{ total: string }>();

    return {
      totalUsers,
      totalOrders,
      ordersToday,
      completedToday,
      revenueToday: parseFloat(revenueResult?.total ?? '0') || 0,
      activeDrivers,
      onlineDrivers,
      pendingDriverApprovals,
    };
  }

  async getDriverEarningsToday(driverId: string): Promise<{ today: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const revenueResult = await this.orderRepository
      .createQueryBuilder('o')
      .select('SUM(o.final_price)', 'total')
      .where('o.driver_id = :driverId', { driverId })
      .andWhere('o.status = :s', { s: 'completed' })
      .andWhere('o.created_at >= :d', { d: today })
      .getRawOne<{ total: string }>();

    return { today: parseFloat(revenueResult?.total ?? '0') || 0 };
  }

  async getDriverEarningsBreakdown(driverId: string): Promise<DriverEarningsBreakdown> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // "This week" = last 7 days including today; "this month" = last 30 days
    // including today (rolling windows, not calendar week/month).
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);

    const startOfMonth = new Date(startOfToday);
    startOfMonth.setDate(startOfMonth.getDate() - 29);

    const [today, week, month] = await Promise.all([
      this.getDriverEarningsForPeriod(driverId, startOfToday),
      this.getDriverEarningsForPeriod(driverId, startOfWeek),
      this.getDriverEarningsForPeriod(driverId, startOfMonth),
    ]);

    return { today, week, month };
  }

  private async getDriverEarningsForPeriod(
    driverId: string,
    from: Date,
  ): Promise<DriverEarningsPeriod> {
    // Commission per trip is already computed and persisted as a DEBIT
    // transaction at completion time (see completeTrip), so sum that ledger
    // entry directly rather than recomputing from the driver's current
    // commission rate (which may have changed since the trip happened).
    const result = await this.orderRepository
      .createQueryBuilder('o')
      .leftJoin(
        Transaction,
        't',
        't.order_id = o.id AND t.user_id = o.driver_id AND t.external_id = :commissionExternalId',
        { commissionExternalId: 'commission' },
      )
      .select('COALESCE(SUM(COALESCE(o.final_price, o.estimated_price)), 0)', 'gross')
      .addSelect('COALESCE(SUM(t.amount), 0)', 'commission')
      .addSelect('COUNT(DISTINCT o.id)', 'trips')
      .where('o.driver_id = :driverId', { driverId })
      .andWhere('o.status = :s', { s: OrderStatus.COMPLETED })
      .andWhere('o.created_at >= :from', { from })
      .getRawOne<{ gross: string; commission: string; trips: string }>();

    const gross = parseFloat(result?.gross ?? '0') || 0;
    const commission = parseFloat(result?.commission ?? '0') || 0;
    const trips = parseInt(result?.trips ?? '0', 10) || 0;

    return { gross, commission, net: gross - commission, trips };
  }

  async getReports(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const [totalOrdersInRange, statsResult, chartResult, topDriversResult, totalDriversResult, newUsersResult] =
      await Promise.all([
        this.orderRepository
          .createQueryBuilder('o')
          .where('o.created_at >= :from', { from: fromDate })
          .andWhere('o.created_at <= :to', { to: toDate })
          .getCount(),
        this.orderRepository
          .createQueryBuilder('o')
          .select('SUM(o.final_price)', 'revenue')
          .addSelect('COUNT(o.id)', 'cnt')
          .where('o.status = :s', { s: 'completed' })
          .andWhere('o.created_at >= :from', { from: fromDate })
          .andWhere('o.created_at <= :to', { to: toDate })
          .getRawOne<{ revenue: string; cnt: string }>(),
        this.orderRepository
          .createQueryBuilder('o')
          .select('DATE(o.created_at)', 'date')
          .addSelect('SUM(o.final_price)', 'revenue')
          .addSelect('COUNT(o.id)', 'orders')
          .where('o.status = :s', { s: 'completed' })
          .andWhere('o.created_at >= :from', { from: fromDate })
          .andWhere('o.created_at <= :to', { to: toDate })
          .groupBy('date')
          .orderBy('date', 'ASC')
          .getRawMany<{ date: string; revenue: string; orders: string }>(),
        this.orderRepository.manager.query(
          `SELECT d.id, u.first_name, u.last_name, u.phone,
                  COUNT(o.id)::int as total_trips,
                  COALESCE(SUM(o.final_price), 0)::float as total_revenue,
                  d.rating
           FROM orders o
           JOIN users u ON u.id = o.driver_id
           JOIN drivers d ON d.user_id = o.driver_id
           WHERE o.status = 'completed'
             AND o.created_at >= $1 AND o.created_at <= $2
           GROUP BY d.id, u.first_name, u.last_name, u.phone, d.rating
           ORDER BY total_revenue DESC
           LIMIT 10`,
          [fromDate, toDate],
        ) as Promise<Array<{ id: string; first_name: string; last_name: string; phone: string; total_trips: number; total_revenue: number; rating: number }>>,
        this.orderRepository.manager.query(
          `SELECT COUNT(*)::int as cnt FROM drivers`,
        ) as Promise<Array<{ cnt: number }>>,
        this.orderRepository.manager.query(
          `SELECT COUNT(*)::int as cnt FROM users WHERE created_at >= $1 AND created_at <= $2`,
          [fromDate, toDate],
        ) as Promise<Array<{ cnt: number }>>,
      ]);

    const totalRevenue = parseFloat(statsResult?.revenue ?? '0') || 0;
    const completedOrders = parseInt(statsResult?.cnt ?? '0', 10) || 0;

    return {
      stats: {
        totalRevenue,
        totalOrders: totalOrdersInRange,
        avgOrderValue: completedOrders > 0 ? totalRevenue / completedOrders : 0,
        totalDrivers: totalDriversResult[0]?.cnt ?? 0,
        activeDrivers: completedOrders,
        newUsers: newUsersResult[0]?.cnt ?? 0,
      },
      revenueChart: chartResult.map((row) => ({
        date: row.date,
        revenue: parseFloat(row.revenue ?? '0') || 0,
        orders: parseInt(row.orders ?? '0', 10) || 0,
      })),
      topDrivers: topDriversResult.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
        totalTrips: row.total_trips,
        totalRevenue: row.total_revenue,
        rating: parseFloat(String(row.rating)) || 0,
      })),
    };
  }

  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  // Sums Haversine distances leg-by-leg across an ordered list of points
  // (pickup -> waypoints... -> dropoff), used for multi-stop ride pricing.
  private haversineRouteDistance(points: { lat: number; lng: number }[]): number {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += this.haversineDistance(
        points[i].lat,
        points[i].lng,
        points[i + 1].lat,
        points[i + 1].lng,
      );
    }
    return total;
  }
}
