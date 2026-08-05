import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Not, Repository } from 'typeorm';
import { Restaurant, RestaurantStatus, WorkingHoursDay } from '../../database/entities/restaurant.entity';
import { MenuCategory } from '../../database/entities/menu-category.entity';
import { Dish } from '../../database/entities/dish.entity';
import { FoodOrder, FoodOrderStatus, FoodPaymentMethod } from '../../database/entities/food-order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { CreateMenuCategoryDto, UpdateMenuCategoryDto } from './dto/category.dto';
import { CreateDishDto, UpdateDishDto } from './dto/dish.dto';
import { CreateFoodOrderDto } from './dto/create-food-order.dto';
import { CreateRestaurantAdminDto } from './dto/create-restaurant-admin.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import { UserRole } from '../../database/entities/user.entity';
import { PaymentMethod, ServiceType } from '../../database/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { MatchingService } from '../matching/matching.service';
import { TariffsService } from '../tariffs/tariffs.service';
import { clampPageSize } from '../../common/utils/pagination.util';

// Rolling window for the analytics that cannot be expressed as a single SQL
// aggregate (per-dish totals live in a jsonb `items` column), plus a hard row
// cap so a very busy restaurant still cannot pull an unbounded result set.
const ANALYTICS_WINDOW_DAYS = 30;
const ANALYTICS_MAX_ORDERS = 2000;

// Number of orders shown in the dashboard's "recent orders" strip; now the
// query's LIMIT rather than a slice of a full-table read.
const RECENT_ORDERS_LIMIT = 6;

// Default page size for a customer's own order history — generous, because the
// existing clients send no pagination parameters at all.
const CUSTOMER_ORDERS_DEFAULT_LIMIT = 50;
const CUSTOMER_ORDERS_MAX_LIMIT = 100;

const DEFAULT_HOURS: WorkingHoursDay[] = [
  { day: 'Dushanba', open: true, from: '09:00', to: '22:00' },
  { day: 'Seshanba', open: true, from: '09:00', to: '22:00' },
  { day: 'Chorshanba', open: true, from: '09:00', to: '22:00' },
  { day: 'Payshanba', open: true, from: '09:00', to: '22:00' },
  { day: 'Juma', open: true, from: '09:00', to: '22:00' },
  { day: 'Shanba', open: true, from: '09:00', to: '22:00' },
  { day: 'Yakshanba', open: true, from: '09:00', to: '22:00' },
];

const ORDER_TRANSITIONS: Record<string, FoodOrderStatus> = {
  [FoodOrderStatus.NEW]: FoodOrderStatus.PREPARING,
  [FoodOrderStatus.PREPARING]: FoodOrderStatus.READY,
  [FoodOrderStatus.READY]: FoodOrderStatus.DELIVERED,
};

@Injectable()
export class FoodService {
  constructor(
    @InjectRepository(Restaurant) private readonly restaurantRepo: Repository<Restaurant>,
    @InjectRepository(MenuCategory) private readonly categoryRepo: Repository<MenuCategory>,
    @InjectRepository(Dish) private readonly dishRepo: Repository<Dish>,
    @InjectRepository(FoodOrder) private readonly orderRepo: Repository<FoodOrder>,
    @InjectRepository(Transaction) private readonly transactionRepo: Repository<Transaction>,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly usersService: UsersService,
    private readonly ordersService: OrdersService,
    private readonly matchingService: MatchingService,
    private readonly tariffsService: TariffsService,
  ) {}

  // ---------- shared ----------

  async getRestaurantByOwner(ownerUserId: string): Promise<Restaurant> {
    const restaurant = await this.restaurantRepo.findOne({ where: { ownerUserId } });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found for this vendor account');
    }
    return restaurant;
  }

  // ---------- vendor: restaurant ----------

  async updateRestaurant(ownerUserId: string, dto: UpdateRestaurantDto): Promise<Restaurant> {
    const restaurant = await this.getRestaurantByOwner(ownerUserId);
    Object.assign(restaurant, dto);
    return this.restaurantRepo.save(restaurant);
  }

  async toggleOpen(ownerUserId: string): Promise<Restaurant> {
    const restaurant = await this.getRestaurantByOwner(ownerUserId);
    restaurant.status =
      restaurant.status === RestaurantStatus.ACTIVE ? RestaurantStatus.CLOSED : RestaurantStatus.ACTIVE;
    return this.restaurantRepo.save(restaurant);
  }

  // ---------- vendor: categories ----------

  listCategories(restaurantId: string): Promise<MenuCategory[]> {
    return this.categoryRepo.find({ where: { restaurantId }, order: { sortOrder: 'ASC' } });
  }

  createCategory(restaurantId: string, dto: CreateMenuCategoryDto): Promise<MenuCategory> {
    return this.categoryRepo.save(
      this.categoryRepo.create({ restaurantId, name: dto.name, sortOrder: dto.sortOrder ?? 0 }),
    );
  }

  async updateCategory(restaurantId: string, id: string, dto: UpdateMenuCategoryDto): Promise<MenuCategory> {
    const category = await this.categoryRepo.findOne({ where: { id, restaurantId } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async deleteCategory(restaurantId: string, id: string): Promise<void> {
    const category = await this.categoryRepo.findOne({ where: { id, restaurantId } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    await this.categoryRepo.remove(category);
  }

  // ---------- vendor: dishes ----------

  listDishes(restaurantId: string): Promise<Dish[]> {
    return this.dishRepo.find({ where: { restaurantId }, order: { createdAt: 'DESC' } });
  }

  createDish(restaurantId: string, dto: CreateDishDto): Promise<Dish> {
    return this.dishRepo.save(
      this.dishRepo.create({
        restaurantId,
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price,
        prepMinutes: dto.prepMinutes ?? 10,
        categoryId: dto.categoryId ?? null,
        tags: dto.tags ?? [],
        isAvailable: true,
      }),
    );
  }

  private async getOwnedDish(restaurantId: string, id: string): Promise<Dish> {
    const dish = await this.dishRepo.findOne({ where: { id, restaurantId } });
    if (!dish) {
      throw new NotFoundException('Dish not found');
    }
    return dish;
  }

  async updateDish(restaurantId: string, id: string, dto: UpdateDishDto): Promise<Dish> {
    const dish = await this.getOwnedDish(restaurantId, id);
    Object.assign(dish, dto);
    return this.dishRepo.save(dish);
  }

  async deleteDish(restaurantId: string, id: string): Promise<void> {
    const dish = await this.getOwnedDish(restaurantId, id);
    await this.dishRepo.remove(dish);
  }

  // ---------- vendor: orders ----------

  private async findOrderEntity(restaurantId: string, id: string): Promise<FoodOrder> {
    const order = await this.orderRepo.findOne({ where: { id, restaurantId }, relations: ['customer'] });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async listOrders(restaurantId: string) {
    const orders = await this.orderRepo.find({
      where: { restaurantId },
      relations: ['customer'],
      order: { createdAt: 'DESC' },
    });
    return Promise.all(orders.map((o) => this.withDelivery(o)));
  }

  async getOrder(restaurantId: string, id: string) {
    const order = await this.findOrderEntity(restaurantId, id);
    return this.withDelivery(order);
  }

  async acceptOrder(restaurantId: string, id: string) {
    const order = await this.findOrderEntity(restaurantId, id);
    if (order.status !== FoodOrderStatus.NEW) {
      throw new BadRequestException('Only new orders can be accepted');
    }
    order.status = FoodOrderStatus.PREPARING;
    const saved = await this.orderRepo.save(order);
    this.realtimeGateway.emitToUser(saved.customerId, 'food:order:status', {
      orderId: saved.id,
      status: saved.status,
    });
    return this.withDelivery(saved);
  }

  async advanceOrder(restaurantId: string, id: string) {
    const order = await this.findOrderEntity(restaurantId, id);
    const next = ORDER_TRANSITIONS[order.status];
    if (!next) {
      throw new BadRequestException(`Order cannot advance from status "${order.status}"`);
    }
    order.status = next;
    let saved = await this.orderRepo.save(order);
    this.realtimeGateway.emitToUser(saved.customerId, 'food:order:status', {
      orderId: saved.id,
      status: saved.status,
    });

    if (next === FoodOrderStatus.READY) {
      const restaurant = await this.restaurantRepo.findOneOrFail({ where: { id: restaurantId } });
      saved = await this.dispatchDelivery(restaurant, saved);
    }

    if (next === FoodOrderStatus.DELIVERED) {
      const restaurant = await this.restaurantRepo.findOneOrFail({ where: { id: restaurantId } });
      await this.settleRestaurantEarnings(restaurant, saved);
    }

    return this.withDelivery(saved);
  }

  // Settles the platform's commission on a delivered order's food total —
  // see MarketService.settleStoreEarnings for the full rationale (mirrors
  // OrdersService.completeTrip's driver payout, but deliberately skips the
  // gross CREDIT leg for cash orders so a restaurant can't withdraw a net
  // payout for money it already collected directly).
  private async settleRestaurantEarnings(restaurant: Restaurant, order: FoodOrder): Promise<void> {
    const commissionAmount = Math.round((order.totalPrice * restaurant.commissionRate) / 100);
    if (commissionAmount <= 0) {
      return;
    }

    const isCash = order.paymentMethod === FoodPaymentMethod.CASH;
    const paymentMethod = isCash ? PaymentMethod.CASH : PaymentMethod.CARD;

    if (!isCash) {
      await this.transactionRepo.save({
        userId: restaurant.ownerUserId,
        orderId: null,
        amount: order.totalPrice,
        type: TransactionType.CREDIT,
        paymentMethod,
        status: TransactionStatus.COMPLETED,
        externalId: `food_order_${order.id}`,
      });
    }

    await this.transactionRepo.save({
      userId: restaurant.ownerUserId,
      orderId: null,
      amount: commissionAmount,
      type: TransactionType.DEBIT,
      paymentMethod,
      status: TransactionStatus.COMPLETED,
      externalId: `food_order_commission_${order.id}`,
    });
  }

  async rejectOrder(restaurantId: string, id: string, reason: string) {
    const order = await this.findOrderEntity(restaurantId, id);
    if (order.status !== FoodOrderStatus.NEW && order.status !== FoodOrderStatus.PREPARING) {
      throw new BadRequestException('Order can no longer be rejected');
    }
    order.status = FoodOrderStatus.CANCELLED;
    order.rejectReason = reason;
    const saved = await this.orderRepo.save(order);
    this.realtimeGateway.emitToUser(saved.customerId, 'food:order:status', {
      orderId: saved.id,
      status: saved.status,
      reason,
    });
    return this.withDelivery(saved);
  }

  // Bridges a Food order into the ride-hailing driver-matching pipeline —
  // creates a real Order (restaurant as pickup, customer as dropoff) and
  // starts the same nearest-driver search used by taxi/cargo.
  private async dispatchDelivery(restaurant: Restaurant, order: FoodOrder): Promise<FoodOrder> {
    if (restaurant.lat == null || restaurant.lng == null) {
      throw new BadRequestException(
        "Restoran manzili (koordinatalar) sozlanmagan — Sozlamalar bo'limida o'rnating",
      );
    }
    const tariffs = await this.tariffsService.findAll('food');
    if (tariffs.length === 0) {
      throw new BadRequestException('No active delivery tariff configured for food orders');
    }

    const deliveryOrder = await this.ordersService.create(order.customerId, {
      tariffId: tariffs[0].id,
      pickupLat: restaurant.lat,
      pickupLng: restaurant.lng,
      dropoffLat: order.deliveryLat,
      dropoffLng: order.deliveryLng,
      pickupAddress: restaurant.name,
      dropoffAddress: order.deliveryAddress,
      serviceType: ServiceType.FOOD,
      details: { foodOrderId: order.id },
    });
    this.matchingService.startSearch(deliveryOrder.id).catch(() => {
      // Matching failures are logged inside MatchingService itself; the
      // food order still moves to "ready", just without an auto-assigned
      // courier yet.
    });

    order.deliveryOrderId = deliveryOrder.id;
    return this.orderRepo.save(order);
  }

  private async withDelivery(order: FoodOrder) {
    if (!order.deliveryOrderId) {
      return { ...order, delivery: null };
    }
    try {
      const deliveryOrder = await this.ordersService.findByIdOrThrow(order.deliveryOrderId);
      return {
        ...order,
        delivery: {
          orderId: deliveryOrder.id,
          status: deliveryOrder.status,
          driverName:
            [deliveryOrder.driver?.firstName, deliveryOrder.driver?.lastName]
              .filter(Boolean)
              .join(' ')
              .trim() || null,
          driverPhone: deliveryOrder.driver?.phone ?? null,
        },
      };
    } catch {
      return { ...order, delivery: null };
    }
  }

  // ---------- vendor: dashboard & reports ----------

  /**
   * Vendor dashboard (GET /food/vendor/dashboard, polled by web-restaurant).
   *
   * This used to load every order the restaurant has ever taken — with the
   * `customer` relation joined on each — plus its whole menu, to compute a few
   * counters in JS. Everything that is a counter is now a COUNT/SUM/AVG done in
   * Postgres against the existing (restaurant_id, created_at) index, and only
   * the six rows actually rendered are materialised.
   *
   * The response shape is unchanged — web-restaurant's `DashboardData` reads
   * each field below by name.
   */
  async getDashboard(restaurantId: string) {
    const restaurant = await this.restaurantRepo.findOneOrFail({ where: { id: restaurantId } });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Average prep time is windowed rather than all-time: a restaurant's current
    // turnaround is what the dashboard is reporting, and an all-time average is
    // both less useful and unbounded to compute.
    const prepSince = new Date();
    prepSince.setDate(prepSince.getDate() - ANALYTICS_WINDOW_DAYS);

    const [todayAggregate, prepAggregate, activeDishesCount, recentOrders] = await Promise.all([
      this.orderRepo
        .createQueryBuilder('o')
        .select('COUNT(o.id)', 'cnt')
        .addSelect('COALESCE(SUM(o.total_price), 0)', 'revenue')
        .where('o.restaurant_id = :restaurantId', { restaurantId })
        .andWhere('o.created_at >= :since', { since: startOfToday })
        .getRawOne<{ cnt: string; revenue: string }>(),
      this.orderRepo
        .createQueryBuilder('o')
        .select(
          'COALESCE(AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60), 0)',
          'avg_minutes',
        )
        .where('o.restaurant_id = :restaurantId', { restaurantId })
        .andWhere('o.status = :status', { status: FoodOrderStatus.DELIVERED })
        .andWhere('o.created_at >= :since', { since: prepSince })
        .getRawOne<{ avg_minutes: string }>(),
      this.dishRepo.count({ where: { restaurantId, isAvailable: true } }),
      this.orderRepo.find({
        where: { restaurantId },
        relations: ['customer'],
        order: { createdAt: 'DESC' },
        take: RECENT_ORDERS_LIMIT,
      }),
    ]);

    return {
      restaurantName: restaurant.name,
      isOpen: restaurant.status === RestaurantStatus.ACTIVE,
      todayOrdersCount: parseInt(todayAggregate?.cnt ?? '0', 10) || 0,
      todayRevenue: parseFloat(todayAggregate?.revenue ?? '0') || 0,
      avgPrepMinutes: Math.round(parseFloat(prepAggregate?.avg_minutes ?? '0') || 0),
      activeDishesCount,
      recentOrders: recentOrders.map((o) => this.serializeOrder(o)),
    };
  }

  /**
   * Vendor reports (GET /food/vendor/reports).
   *
   * The `since` cut-off and the cancelled-order exclusion were already applied,
   * but in JS after reading every order row for the restaurant — so the "last 7
   * days" report still scanned the full history. Both predicates now live in the
   * query (`rangeDays` is a fixed 7 or 30 chosen by the controller), with a row
   * cap as a backstop.
   *
   * The per-dish and hourly figures still have to be tallied in the process
   * because `items` is a jsonb column, but they now run over the bounded set.
   */
  async getReports(restaurantId: string, rangeDays: number) {
    const restaurant = await this.restaurantRepo.findOneOrFail({ where: { id: restaurantId } });
    const since = new Date();
    since.setDate(since.getDate() - rangeDays);
    const inRange = await this.orderRepo.find({
      where: {
        restaurantId,
        createdAt: MoreThanOrEqual(since),
        status: Not(FoodOrderStatus.CANCELLED),
      },
      order: { createdAt: 'DESC' },
      take: ANALYTICS_MAX_ORDERS,
    });

    const days = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
    const revenue = Array.from({ length: rangeDays }, (_, i) => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - (rangeDays - 1 - i));
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const total = inRange
        .filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd)
        .reduce((sum, o) => sum + Number(o.totalPrice), 0);
      return { day: days[dayStart.getDay()], total };
    });

    const dishSold = new Map<string, { name: string; qty: number }>();
    const hourly = new Array(24).fill(0);
    for (const order of inRange) {
      hourly[order.createdAt.getHours()] += 1;
      for (const item of order.items) {
        const entry = dishSold.get(item.dishId) ?? { name: item.name, qty: 0 };
        entry.qty += item.qty;
        dishSold.set(item.dishId, entry);
      }
    }
    const topDishes = [...dishSold.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    const gross = inRange.reduce((sum, o) => sum + Number(o.totalPrice), 0);
    const commission = Math.round(gross * (restaurant.commissionRate / 100));

    return {
      revenue,
      topDishes,
      hourly: hourly.map((count, hour) => ({ hour, count })),
      payout: {
        gross,
        commission,
        net: gross - commission,
        orders: inRange.length,
        commissionRate: restaurant.commissionRate,
      },
    };
  }

  private serializeOrder(order: FoodOrder) {
    return {
      id: order.id,
      customer: [order.customer?.firstName, order.customer?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || order.customerPhone || 'Mijoz',
      status: order.status,
      itemsCount: order.items.reduce((sum, i) => sum + i.qty, 0),
      totalPrice: Number(order.totalPrice),
      createdAt: order.createdAt,
    };
  }

  // ---------- storefront (customer) ----------

  listActiveRestaurants(): Promise<Restaurant[]> {
    return this.restaurantRepo.find({ where: { status: RestaurantStatus.ACTIVE }, order: { name: 'ASC' } });
  }

  async getRestaurantDetail(restaurantId: string) {
    const restaurant = await this.restaurantRepo.findOne({ where: { id: restaurantId } });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    const [categories, dishes] = await Promise.all([
      this.categoryRepo.find({ where: { restaurantId }, order: { sortOrder: 'ASC' } }),
      this.dishRepo.find({ where: { restaurantId, isAvailable: true } }),
    ]);
    return { restaurant, categories, dishes };
  }

  async createOrder(customerId: string, customerPhone: string | null, dto: CreateFoodOrderDto): Promise<FoodOrder> {
    const restaurant = await this.restaurantRepo.findOne({ where: { id: dto.restaurantId } });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const dishes = await this.dishRepo.find({ where: { restaurantId: restaurant.id } });
    const byId = new Map(dishes.map((d) => [d.id, d]));

    const items = dto.items.map((input) => {
      const dish = byId.get(input.dishId);
      if (!dish) {
        throw new NotFoundException(`Dish ${input.dishId} not found in this restaurant`);
      }
      if (!dish.isAvailable) {
        throw new ConflictException(`"${dish.name}" is not available`);
      }
      return {
        dishId: dish.id,
        name: dish.name,
        qty: input.qty,
        price: Number(dish.price),
        prepMinutes: dish.prepMinutes,
      };
    });

    const totalPrice = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    const order = await this.orderRepo.save(
      this.orderRepo.create({
        restaurantId: restaurant.id,
        customerId,
        items,
        totalPrice,
        deliveryAddress: dto.deliveryAddress,
        deliveryLat: dto.deliveryLat,
        deliveryLng: dto.deliveryLng,
        customerPhone,
        paymentMethod: dto.paymentMethod ?? FoodPaymentMethod.CASH,
        note: dto.note ?? null,
        status: FoodOrderStatus.NEW,
      }),
    );

    this.realtimeGateway.emitToUser(restaurant.ownerUserId, 'food:order:created', {
      orderId: order.id,
      restaurantId: restaurant.id,
    });

    return order;
  }

  /**
   * A customer's own food order history (GET /food/orders).
   *
   * Was an unbounded read of the customer's entire history, each row then fanned
   * out into a `withDelivery` lookup. Bounded the same way as the Market
   * equivalent, and for the same reason the response stays a bare array: the
   * Flutter client decodes `/food/orders` as a list, so pagination is opt-in and
   * a caller that sends nothing keeps the previous behaviour.
   */
  async listCustomerOrders(customerId: string, page = 1, limit = CUSTOMER_ORDERS_DEFAULT_LIMIT) {
    const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
    const safeLimit = clampPageSize(limit, CUSTOMER_ORDERS_DEFAULT_LIMIT, CUSTOMER_ORDERS_MAX_LIMIT);

    const orders = await this.orderRepo.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });
    return Promise.all(orders.map((o) => this.withDelivery(o)));
  }

  async getCustomerOrder(customerId: string, id: string) {
    const order = await this.orderRepo.findOne({ where: { id, customerId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.withDelivery(order);
  }

  // ---------- admin ----------

  adminListRestaurants(): Promise<Restaurant[]> {
    return this.restaurantRepo.find({ relations: ['owner'], order: { createdAt: 'DESC' } });
  }

  async adminCreateRestaurant(dto: CreateRestaurantAdminDto): Promise<Restaurant> {
    const owner = await this.usersService.createWithRole(
      dto.phone,
      UserRole.RESTAURANT,
      dto.firstName,
      dto.lastName,
    );
    return this.restaurantRepo.save(
      this.restaurantRepo.create({
        ownerUserId: owner.id,
        name: dto.restaurantName,
        phone: dto.restaurantPhone ?? dto.phone,
        address: dto.restaurantAddress ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        hours: DEFAULT_HOURS,
        status: RestaurantStatus.ACTIVE,
      }),
    );
  }

  async adminSetRestaurantStatus(id: string, status: RestaurantStatus): Promise<Restaurant> {
    const restaurant = await this.restaurantRepo.findOne({ where: { id } });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    restaurant.status = status;
    return this.restaurantRepo.save(restaurant);
  }

  // Content moderation — an admin reviewing dishes across every restaurant,
  // not scoped to a single vendor's own menu (see listDishes for that).
  adminListDishes(): Promise<Dish[]> {
    return this.dishRepo.find({ relations: ['restaurant'], order: { createdAt: 'DESC' } });
  }

  async adminDeleteDish(id: string): Promise<void> {
    const dish = await this.dishRepo.findOne({ where: { id } });
    if (!dish) {
      throw new NotFoundException('Dish not found');
    }
    await this.dishRepo.remove(dish);
  }
}
