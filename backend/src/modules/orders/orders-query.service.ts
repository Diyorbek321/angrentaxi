// Read side of the orders module: single-order lookups (including the
// ownership-checked variant used by the public GET /orders/:id endpoint),
// paginated history/listing queries, the dispatcher board feed, and the
// dispatch-override audit list. Also owns attachDisplayFields, the response
// enrichment every read path shares — which is why the write-side services
// (creation, lifecycle, completion, dispatch) depend on this service for their
// own findByIdOrThrow calls rather than duplicating it.
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { DispatchOverride } from '../../database/entities/dispatch-override.entity';
import { UserRole } from '../../database/entities/user.entity';
import { DriversService } from '../drivers/drivers.service';
import { PaginatedOrders } from './orders.types';

// Upper bound on the dispatcher board feed (see getActiveOrders). Sized well
// above any realistic number of simultaneously in-flight orders for a single
// city, so it acts as a runaway guard rather than as pagination.
const ACTIVE_ORDERS_LIMIT = 200;

@Injectable()
export class OrdersQueryService {
  private readonly logger = new Logger(OrdersQueryService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(DispatchOverride)
    private readonly dispatchOverrideRepository: Repository<DispatchOverride>,
    private readonly driversService: DriversService,
  ) {}

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

  /**
   * Dispatcher board feed (GET /orders/active, polled by web-manager).
   *
   * Hard-capped: this used to be an unbounded `find()` that loaded every
   * in-flight order plus three eagerly joined relations on every poll. The
   * board only ever renders a screenful, so ACTIVE_ORDERS_LIMIT newest
   * orders is plenty; without the cap a matching backlog (many orders stuck
   * in SEARCHING) turns a routine poll into a full table read.
   *
   * The response shape stays a bare `Order[]` because web-manager's
   * `getActiveOrders()` in web-manager/src/lib/api.ts unwraps
   * `ApiResponse<Order[]>` directly — wrapping it in a
   * `{ orders, truncated }` envelope would break the panel. Truncation is
   * therefore signalled out-of-band, as a server-side warning log: if it
   * ever fires in production it means dispatch is genuinely backlogged, and
   * the board needs real pagination rather than a bigger cap.
   */
  async getActiveOrders(): Promise<Order[]> {
    const orders = await this.orderRepository.find({
      where: [
        { status: OrderStatus.SEARCHING },
        { status: OrderStatus.ACCEPTED },
        { status: OrderStatus.ARRIVED },
        { status: OrderStatus.IN_PROGRESS },
      ],
      order: { createdAt: 'DESC' },
      take: ACTIVE_ORDERS_LIMIT,
      relations: ['passenger', 'driver', 'tariff'],
    });

    if (orders.length === ACTIVE_ORDERS_LIMIT) {
      this.logger.warn(
        `Active orders hit the ${ACTIVE_ORDERS_LIMIT}-row dispatcher cap; ` +
          'older in-flight orders are not being shown on the board.',
      );
    }

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
   * Ownership-checked variant of {@link findByIdOrThrow} for the public
   * `GET /orders/:id` endpoint.
   *
   * `findByIdOrThrow` eagerly loads the `passenger`, `driver` and `tariff`
   * relations (names, phone numbers, addresses) and is used from many
   * internal call sites, so it must stay permissive. This wrapper adds the
   * access rule for externally reachable reads: only the order's passenger,
   * the assigned driver, or a manager/admin may read an order.
   *
   * Note: `order.driverId` references `User.id` (the `driver` relation is a
   * `@ManyToOne(() => User)`), not `Driver.id`, so comparing it against the
   * authenticated user's id is correct.
   */
  async findByIdForUser(
    id: string,
    user: { id: string; role: UserRole },
  ): Promise<Order> {
    const order = await this.findByIdOrThrow(id);

    const isPassenger = order.passengerId === user.id;
    const isAssignedDriver = order.driverId !== null && order.driverId === user.id;
    const isStaff = user.role === UserRole.MANAGER || user.role === UserRole.ADMIN;

    if (!isPassenger && !isAssignedDriver && !isStaff) {
      throw new ForbiddenException('You are not authorized to view this order');
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
      relations: ['passenger', 'driver', 'tariff'],
    });
    return { orders: await this.attachDisplayFields(orders), total, page, limit };
  }

  // Dispatcher "Exceptions" worklist — orders MatchingService gave up on
  // (see MatchingService.handleNoDriversFound, which cancels with this exact
  // reason string once the 60s search deadline passes with no acceptance).
  // Read-only: a cancelled order isn't in reassignableStatuses, so the
  // remedy is a fresh manual order (Manual Order Creation), not a reassign.
  async getNoDriversFoundExceptions(
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedOrders> {
    const [orders, total] = await this.orderRepository.findAndCount({
      where: { status: OrderStatus.CANCELLED, cancelReason: 'No drivers available' },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['passenger', 'driver', 'tariff'],
    });
    return { orders: await this.attachDisplayFields(orders), total, page, limit };
  }

  async getDispatchOverrides(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ overrides: DispatchOverride[]; total: number; page: number; limit: number }> {
    const [overrides, total] = await this.dispatchOverrideRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { overrides, total, page, limit };
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
}
