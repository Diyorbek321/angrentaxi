import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import { Trip } from '../../database/entities/trip.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { TariffsService } from '../tariffs/tariffs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { DriversService } from '../drivers/drivers.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { UserRole } from '../../database/entities/user.entity';

export interface PaginatedOrders {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
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

    // Estimate distance using Haversine formula (frontend should provide actual distance)
    const estimatedDistanceKm = this.haversineDistance(
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

    // Create order with PostGIS geometry
    const savedOrder = await this.orderRepository.query(
      `INSERT INTO orders (passenger_id, tariff_id, pickup_location, dropoff_location,
        pickup_address, dropoff_address, estimated_price, status, payment_method, note)
       VALUES ($1, $2,
         ST_SetSRID(ST_MakePoint($3, $4), 4326),
         ST_SetSRID(ST_MakePoint($5, $6), 4326),
         $7, $8, $9, $10, $11, $12)
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
        estimatedPrice,
        OrderStatus.CREATED,
        dto.paymentMethod ?? PaymentMethod.CASH,
        dto.note ?? null,
      ],
    );

    const orderId = (savedOrder as Array<{ id: string }>)[0].id;
    const order = await this.findByIdOrThrow(orderId);

    // Notify passenger order was created
    this.realtimeGateway.emitToUser(passengerId, 'order:created', {
      orderId,
      status: OrderStatus.CREATED,
    });

    // Start driver matching asynchronously
    // Note: matching module will be injected via forward reference to avoid circular deps
    this.logger.log(`Order ${orderId} created, starting driver search...`);

    return order;
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

    await this.orderRepository.update(orderId, {
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

    const distanceMeters = parseFloat(
      (geofenceCheck as Array<{ distance_meters: string }>)[0]?.distance_meters || '9999',
    );

    if (distanceMeters > 500) {
      this.logger.warn(
        `Driver ${driverId} is ${distanceMeters.toFixed(0)}m away from pickup, rejecting arrived status`,
      );
      throw new BadRequestException(
        `You must be within 500m of the pickup location (currently ${distanceMeters.toFixed(0)}m away)`,
      );
    }

    await this.orderRepository.update(orderId, { status: OrderStatus.ARRIVED });

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

    await this.orderRepository.update(orderId, { status: OrderStatus.IN_PROGRESS });

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

    // Update order
    await this.orderRepository.update(orderId, {
      status: OrderStatus.COMPLETED,
      finalPrice,
    });

    // Create transaction record
    await this.transactionRepository.save({
      userId: order.passengerId,
      orderId,
      amount: finalPrice,
      type: TransactionType.DEBIT,
      paymentMethod: order.paymentMethod,
      status: order.paymentMethod === PaymentMethod.CASH
        ? TransactionStatus.COMPLETED
        : TransactionStatus.PENDING,
      externalId: null,
    });

    const updatedOrder = await this.findByIdOrThrow(orderId);

    // Notify passenger
    const passenger = await this.usersService.findById(order.passengerId);

    if (passenger) {
      this.realtimeGateway.emitToUser(order.passengerId, 'order:completed', {
        orderId,
        finalPrice,
        actualDistanceKm,
        actualDurationMin,
      });

      await this.notificationsService.notifyTripCompleted(passenger, finalPrice, updatedOrder);
    }

    this.logger.log(
      `Order ${orderId} completed. Distance: ${actualDistanceKm.toFixed(2)}km, Price: ${finalPrice} UZS`,
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

    await this.orderRepository.update(orderId, {
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
      relations: ['tariff'],
    });

    return { orders, total, page, limit };
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
      relations: ['tariff'],
    });

    return { orders, total, page, limit };
  }

  async getActiveOrders(): Promise<Order[]> {
    return this.orderRepository.find({
      where: [
        { status: OrderStatus.SEARCHING },
        { status: OrderStatus.ACCEPTED },
        { status: OrderStatus.ARRIVED },
        { status: OrderStatus.IN_PROGRESS },
      ],
      order: { createdAt: 'DESC' },
      relations: ['tariff'],
    });
  }

  async findByIdOrThrow(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['tariff'],
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
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
      relations: ['tariff'],
    });
    return { orders, total, page, limit };
  }

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOrders, ordersToday, completedToday, totalUsers] = await Promise.all([
      this.orderRepository.count(),
      this.orderRepository.count({ where: [{ createdAt: today as any }] }),
      this.orderRepository.createQueryBuilder('o')
        .where('o.status = :s', { s: 'completed' })
        .andWhere('o.created_at >= :d', { d: today })
        .getCount(),
      this.orderRepository.manager.getRepository('users').count(),
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
      activeDrivers: 0,
      onlineDrivers: 0,
      pendingDriverApprovals: 0,
    };
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
}
