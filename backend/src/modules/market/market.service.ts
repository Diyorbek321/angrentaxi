import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { Store, StoreDeliveryMode, StoreStatus } from '../../database/entities/store.entity';
import { MarketCategory } from '../../database/entities/market-category.entity';
import { Product, ProductStatus } from '../../database/entities/product.entity';
import { StockMovement } from '../../database/entities/stock-movement.entity';
import {
  MarketOrder,
  MarketOrderDeliveryMode,
  MarketOrderStatus,
  MarketPaymentMethod,
} from '../../database/entities/market-order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { UpdateStoreDto } from './dto/update-store.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { BulkUpdateProductsDto } from './dto/bulk-update-products.dto';
import { CreateMarketOrderDto } from './dto/create-market-order.dto';
import { CreateStoreAdminDto } from './dto/create-store-admin.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import { UserRole } from '../../database/entities/user.entity';
import { PaymentMethod, ServiceType } from '../../database/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { MatchingService } from '../matching/matching.service';
import { TariffsService } from '../tariffs/tariffs.service';
import { clampPageSize } from '../../common/utils/pagination.util';

// Rolling window the jsonb-item analytics (best sellers, category breakdown,
// stock turnover) are computed over, plus a hard row cap in case a very busy
// store fills that window. Both exist because `items` is jsonb and cannot be
// aggregated by a plain SUM — the rows have to be read into the process, so the
// set they are read from must be bounded.
const ANALYTICS_WINDOW_DAYS = 30;
const ANALYTICS_MAX_ORDERS = 2000;
const ANALYTICS_MAX_PRODUCTS = 2000;

// Dashboard list sizes. Both were previously derived by slicing a full-table
// read; they are now the query's own LIMIT.
const RECENT_ORDERS_LIMIT = 5;
const LOW_STOCK_LIST_LIMIT = 50;

// Default page size for a customer's own order history. Kept generous so the
// existing clients — which send no pagination parameters at all — keep seeing
// their whole realistic history in one response.
const CUSTOMER_ORDERS_DEFAULT_LIMIT = 50;
const CUSTOMER_ORDERS_MAX_LIMIT = 100;

const ORDER_TRANSITIONS: Record<string, MarketOrderStatus> = {
  [MarketOrderStatus.NEW]: MarketOrderStatus.PACKING,
  [MarketOrderStatus.PACKING]: MarketOrderStatus.SHIPPED,
  [MarketOrderStatus.SHIPPED]: MarketOrderStatus.DELIVERED,
};

@Injectable()
export class MarketService {
  constructor(
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    @InjectRepository(MarketCategory)
    private readonly categoryRepo: Repository<MarketCategory>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(StockMovement)
    private readonly movementRepo: Repository<StockMovement>,
    @InjectRepository(MarketOrder) private readonly orderRepo: Repository<MarketOrder>,
    @InjectRepository(Transaction) private readonly transactionRepo: Repository<Transaction>,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly usersService: UsersService,
    private readonly ordersService: OrdersService,
    private readonly matchingService: MatchingService,
    private readonly tariffsService: TariffsService,
  ) {}

  // ---------- shared helpers ----------

  async getStoreByOwner(ownerUserId: string): Promise<Store> {
    const store = await this.storeRepo.findOne({ where: { ownerUserId } });
    if (!store) {
      throw new NotFoundException('Store not found for this vendor account');
    }
    return store;
  }

  private async getOwnedProduct(storeId: string, productId: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id: productId, storeId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private async recordStockChange(
    storeId: string,
    product: Product,
    newStock: number,
    note: string,
  ): Promise<Product> {
    const delta = newStock - product.stock;
    product.stock = newStock;
    product.status =
      newStock === 0
        ? ProductStatus.OUT
        : product.status === ProductStatus.OUT
          ? ProductStatus.ACTIVE
          : product.status;
    const saved = await this.productRepo.save(product);
    if (delta !== 0) {
      await this.movementRepo.save(
        this.movementRepo.create({ storeId, productId: product.id, delta, note }),
      );
    }
    return saved;
  }

  // ---------- vendor: store ----------

  async updateStore(ownerUserId: string, dto: UpdateStoreDto): Promise<Store> {
    const store = await this.getStoreByOwner(ownerUserId);
    Object.assign(store, dto);
    return this.storeRepo.save(store);
  }

  // ---------- vendor: categories ----------

  listCategories(storeId: string): Promise<MarketCategory[]> {
    return this.categoryRepo.find({ where: { storeId }, order: { sortOrder: 'ASC' } });
  }

  createCategory(storeId: string, dto: CreateCategoryDto): Promise<MarketCategory> {
    return this.categoryRepo.save(
      this.categoryRepo.create({
        storeId,
        name: dto.name,
        emoji: dto.emoji ?? '🛒',
        sortOrder: dto.sortOrder ?? 0,
      }),
    );
  }

  async updateCategory(
    storeId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<MarketCategory> {
    const category = await this.categoryRepo.findOne({ where: { id, storeId } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async deleteCategory(storeId: string, id: string): Promise<void> {
    const category = await this.categoryRepo.findOne({ where: { id, storeId } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    await this.categoryRepo.remove(category);
  }

  // ---------- vendor: products ----------

  listProducts(storeId: string): Promise<Product[]> {
    return this.productRepo.find({ where: { storeId }, order: { createdAt: 'DESC' } });
  }

  createProduct(storeId: string, dto: CreateProductDto): Promise<Product> {
    const stock = dto.stock;
    return this.productRepo.save(
      this.productRepo.create({
        storeId,
        name: dto.name,
        sku: dto.sku ?? null,
        price: dto.price,
        stock,
        unit: dto.unit,
        categoryId: dto.categoryId ?? null,
        emoji: dto.emoji ?? '📦',
        hue: dto.hue ?? Math.floor(Math.random() * 360),
        status: stock === 0 ? ProductStatus.OUT : ProductStatus.ACTIVE,
      }),
    );
  }

  async updateProduct(
    storeId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.getOwnedProduct(storeId, id);

    if (dto.stock !== undefined && dto.stock !== product.stock) {
      await this.recordStockChange(storeId, product, dto.stock, "Qo'lda o'zgartirildi");
    }

    const { stock, ...rest } = dto;
    Object.assign(product, rest);
    return this.productRepo.save(product);
  }

  async bulkUpdateProductStatus(
    storeId: string,
    dto: BulkUpdateProductsDto,
  ): Promise<{ updated: number }> {
    const products = await this.productRepo.find({
      where: { storeId },
    });
    const toUpdate = products.filter((p) => dto.productIds.includes(p.id));
    for (const product of toUpdate) {
      product.status = dto.status;
    }
    await this.productRepo.save(toUpdate);
    return { updated: toUpdate.length };
  }

  async deleteProduct(storeId: string, id: string): Promise<void> {
    const product = await this.getOwnedProduct(storeId, id);
    await this.productRepo.remove(product);
  }

  listStockMovements(storeId: string): Promise<StockMovement[]> {
    return this.movementRepo.find({
      where: { storeId },
      relations: ['product'],
      order: { createdAt: 'DESC' },
      take: 30,
    });
  }

  // ---------- vendor: orders ----------

  private async findOrderEntity(storeId: string, id: string): Promise<MarketOrder> {
    const order = await this.orderRepo.findOne({
      where: { id, storeId },
      relations: ['customer'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async listOrders(storeId: string, status?: MarketOrderStatus) {
    const orders = await this.orderRepo.find({
      where: status ? { storeId, status } : { storeId },
      relations: ['customer'],
      order: { createdAt: 'DESC' },
    });
    return Promise.all(orders.map((o) => this.withDelivery(o)));
  }

  async getOrder(storeId: string, id: string) {
    const order = await this.findOrderEntity(storeId, id);
    return this.withDelivery(order);
  }

  async togglePackItem(storeId: string, orderId: string, itemIndex: number) {
    const order = await this.findOrderEntity(storeId, orderId);
    const item = order.items[itemIndex];
    if (!item) {
      throw new BadRequestException('Invalid item index');
    }
    item.packed = !item.packed;
    const saved = await this.orderRepo.save(order);
    return this.withDelivery(saved);
  }

  async advanceOrder(storeId: string, orderId: string) {
    const order = await this.findOrderEntity(storeId, orderId);
    const next = ORDER_TRANSITIONS[order.status];
    if (!next) {
      throw new BadRequestException(`Order cannot advance from status "${order.status}"`);
    }
    order.status = next;
    let saved = await this.orderRepo.save(order);
    this.realtimeGateway.emitToUser(saved.customerId, 'market:order:status', {
      orderId: saved.id,
      status: saved.status,
    });

    if (next === MarketOrderStatus.SHIPPED) {
      const store = await this.storeRepo.findOneOrFail({ where: { id: storeId } });
      if (store.deliveryMode === StoreDeliveryMode.PLATFORM) {
        saved = await this.dispatchDelivery(store, saved);
      }
    }

    if (next === MarketOrderStatus.DELIVERED) {
      const store = await this.storeRepo.findOneOrFail({ where: { id: storeId } });
      await this.settleStoreEarnings(store, saved);
    }

    return this.withDelivery(saved);
  }

  // Settles the platform's commission on a delivered order's goods total —
  // separate from (and in addition to) any courier delivery-fee commission
  // OrdersService/DriversService already settles for the dispatched delivery
  // Order. A CASH order means the customer already paid the store directly
  // (at pickup, or via COD reconciliation with the courier) — the platform
  // never held that money, so only the commission the store now owes hits
  // the ledger, as a DEBIT (mirrors a driver's cash-trip commission in
  // OrdersService.completeTrip). Deliberately does NOT also book a gross
  // CREDIT for cash orders: doing so would let the store's ledger-computed
  // wallet balance (see PaymentsService.computeBalance, used by
  // requestWithdrawal) show a positive net payout it could withdraw from the
  // platform on top of cash it already has in hand. A CARD/online order
  // means the platform holds the funds, so the store is credited the gross
  // and debited the commission, netting to the payout the platform owes.
  private async settleStoreEarnings(store: Store, order: MarketOrder): Promise<void> {
    const commissionAmount = Math.round((order.totalPrice * store.commissionRate) / 100);
    if (commissionAmount <= 0) {
      return;
    }

    const isCash = order.paymentMethod === MarketPaymentMethod.CASH;
    const paymentMethod = isCash ? PaymentMethod.CASH : PaymentMethod.CARD;

    if (!isCash) {
      await this.transactionRepo.save({
        userId: store.ownerUserId,
        orderId: null,
        amount: order.totalPrice,
        type: TransactionType.CREDIT,
        paymentMethod,
        status: TransactionStatus.COMPLETED,
        externalId: `market_order_${order.id}`,
      });
    }

    await this.transactionRepo.save({
      userId: store.ownerUserId,
      orderId: null,
      amount: commissionAmount,
      type: TransactionType.DEBIT,
      paymentMethod,
      status: TransactionStatus.COMPLETED,
      externalId: `market_order_commission_${order.id}`,
    });
  }

  // Bridges a Market order into the ride-hailing driver-matching pipeline —
  // creates a real Order (store as pickup, customer as dropoff) and starts
  // the same nearest-driver search used by taxi/cargo.
  private async dispatchDelivery(store: Store, order: MarketOrder): Promise<MarketOrder> {
    if (store.lat == null || store.lng == null) {
      throw new BadRequestException(
        "Do'kon manzili (koordinatalar) sozlanmagan — Sozlamalar bo'limida o'rnating",
      );
    }
    const tariffs = await this.tariffsService.findAll('market');
    if (tariffs.length === 0) {
      throw new BadRequestException('No active delivery tariff configured for market orders');
    }

    const deliveryOrder = await this.ordersService.create(order.customerId, {
      tariffId: tariffs[0].id,
      pickupLat: store.lat,
      pickupLng: store.lng,
      dropoffLat: order.deliveryLat,
      dropoffLng: order.deliveryLng,
      pickupAddress: store.name,
      dropoffAddress: order.deliveryAddress,
      serviceType: ServiceType.MARKET,
      details: { marketOrderId: order.id },
    });
    this.matchingService.startSearch(deliveryOrder.id).catch(() => {
      // Matching failures are logged inside MatchingService itself; the
      // market order still ships, just without an auto-assigned courier yet.
    });

    order.deliveryOrderId = deliveryOrder.id;
    return this.orderRepo.save(order);
  }

  private async withDelivery(order: MarketOrder) {
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
   * Vendor dashboard (GET /market/vendor/dashboard, polled by web-market).
   *
   * This used to load the store's entire product catalogue and its entire order
   * history — with the `customer` relation joined on every row — only to derive
   * a handful of counters from them in JS. A vendor with a few thousand orders
   * turned each dashboard poll into a full read of both tables.
   *
   * The counters are now COUNT/SUM aggregates evaluated in Postgres against the
   * existing (store_id, created_at) / (store_id, status) indexes, and only the
   * rows actually rendered are materialised. The response shape is unchanged —
   * web-market's `DashboardData` reads every field below by name.
   */
  async getDashboard(storeId: string) {
    const store = await this.storeRepo.findOneOrFail({ where: { id: storeId } });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      todayAggregate,
      outOfStockCount,
      activeProductsCount,
      hiddenProductsCount,
      lowStock,
      recentOrders,
      bestSellerOrders,
    ] = await Promise.all([
      this.orderRepo
        .createQueryBuilder('o')
        .select('COUNT(o.id)', 'cnt')
        .addSelect('COALESCE(SUM(o.total_price), 0)', 'revenue')
        .where('o.store_id = :storeId', { storeId })
        .andWhere('o.created_at >= :since', { since: startOfToday })
        .getRawOne<{ cnt: string; revenue: string }>(),
      this.productRepo.count({ where: { storeId, stock: 0 } }),
      this.productRepo.count({ where: { storeId, status: ProductStatus.ACTIVE } }),
      this.productRepo.count({ where: { storeId, status: ProductStatus.HIDDEN } }),
      // Scarcest first, so the capped list is the part the vendor must act on.
      this.productRepo.find({
        where: { storeId, stock: Between(1, store.lowStockThreshold) },
        order: { stock: 'ASC' },
        take: LOW_STOCK_LIST_LIMIT,
      }),
      this.orderRepo.find({
        where: { storeId },
        relations: ['customer'],
        order: { createdAt: 'DESC' },
        take: RECENT_ORDERS_LIMIT,
      }),
      this.findOrdersForAggregation(storeId),
    ]);

    return {
      storeName: store.name,
      lowStockThreshold: store.lowStockThreshold,
      todayOrdersCount: parseInt(todayAggregate?.cnt ?? '0', 10) || 0,
      todayRevenue: parseFloat(todayAggregate?.revenue ?? '0') || 0,
      outOfStockCount,
      activeProductsCount,
      hiddenProductsCount,
      lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, stock: p.stock, unit: p.unit })),
      recentOrders: recentOrders.map((o) => this.serializeOrder(o)),
      bestSellers: this.computeBestSellers(bestSellerOrders).slice(0, 5),
    };
  }

  /**
   * Loads the order rows the JSON-item aggregates (best sellers, category
   * breakdown, stock turnover) are computed from.
   *
   * `items` is a jsonb column, so those totals cannot be pushed into a plain
   * SUM the way revenue can. Instead of reading the whole order history, the
   * set is bounded twice: to a rolling ANALYTICS_WINDOW_DAYS window and to a
   * hard row cap. Note this narrows the figures from all-time to the window —
   * intentional, since "best seller" and "stock turnover" are only meaningful
   * against recent trade anyway, and the response shape is unaffected.
   */
  private findOrdersForAggregation(storeId: string): Promise<MarketOrder[]> {
    const since = new Date();
    since.setDate(since.getDate() - ANALYTICS_WINDOW_DAYS);

    return this.orderRepo.find({
      where: { storeId, createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'DESC' },
      take: ANALYTICS_MAX_ORDERS,
    });
  }

  /**
   * Vendor reports (GET /market/vendor/reports).
   *
   * Previously read every order and every product the store has ever had. Both
   * reads are now bounded: orders to the analytics window (see
   * findOrdersForAggregation), products to the rows needed for the category
   * lookup and the stock-on-hand total, which is a single SUM.
   */
  async getReports(storeId: string) {
    const [orders, products, stockAggregate] = await Promise.all([
      this.findOrdersForAggregation(storeId),
      this.productRepo.find({ where: { storeId }, relations: ['category'], take: ANALYTICS_MAX_PRODUCTS }),
      this.productRepo
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.stock), 0)', 'stock')
        .where('p.store_id = :storeId', { storeId })
        .getRawOne<{ stock: string }>(),
    ]);

    const days = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
    const weeklyRevenue = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - (6 - i));
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const total = orders
        .filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd)
        .reduce((sum, o) => sum + Number(o.totalPrice), 0);
      return { day: days[dayStart.getDay()], total };
    });

    const categoryTotals = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        const product = products.find((p) => p.id === item.productId);
        const categoryName = product?.category?.name ?? "Boshqa";
        categoryTotals.set(
          categoryName,
          (categoryTotals.get(categoryName) ?? 0) + item.qty * item.price,
        );
      }
    }
    const grandTotal = [...categoryTotals.values()].reduce((a, b) => a + b, 0) || 1;
    const categoryBreakdown = [...categoryTotals.entries()].map(([name, total]) => ({
      name,
      total,
      pct: Math.round((total / grandTotal) * 100),
    }));

    const totalUnitsSold = orders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0),
      0,
    );
    const totalCurrentStock = parseInt(stockAggregate?.stock ?? '0', 10) || 0;
    const stockTurnover = totalCurrentStock > 0 ? totalUnitsSold / totalCurrentStock : 0;

    return {
      weeklyRevenue,
      categoryBreakdown,
      bestSellers: this.computeBestSellers(orders).slice(0, 5),
      stockTurnover: Math.round(stockTurnover * 10) / 10,
    };
  }

  private computeBestSellers(orders: MarketOrder[]) {
    const sold = new Map<string, { name: string; sold: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const entry = sold.get(item.productId) ?? { name: item.name, sold: 0 };
        entry.sold += item.qty;
        sold.set(item.productId, entry);
      }
    }
    return [...sold.values()].sort((a, b) => b.sold - a.sold);
  }

  private serializeOrder(order: MarketOrder) {
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

  async listActiveStores(): Promise<Store[]> {
    return this.storeRepo.find({ where: { status: StoreStatus.ACTIVE }, order: { name: 'ASC' } });
  }

  async getStoreDetail(storeId: string) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const [categories, products] = await Promise.all([
      this.categoryRepo.find({ where: { storeId, isActive: true }, order: { sortOrder: 'ASC' } }),
      this.productRepo.find({ where: { storeId, status: ProductStatus.ACTIVE } }),
    ]);
    return { store, categories, products };
  }

  async createOrder(customerId: string, customerPhone: string | null, dto: CreateMarketOrderDto) {
    const store = await this.storeRepo.findOne({ where: { id: dto.storeId } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.productRepo.find({ where: { storeId: store.id } });
    const byId = new Map(products.map((p) => [p.id, p]));

    const items = dto.items.map((input) => {
      const product = byId.get(input.productId);
      if (!product || !productIds.includes(product.id)) {
        throw new NotFoundException(`Product ${input.productId} not found in this store`);
      }
      if (product.status !== ProductStatus.ACTIVE) {
        throw new ConflictException(`"${product.name}" is not available`);
      }
      if (product.stock < input.qty) {
        throw new ConflictException(`Not enough stock for "${product.name}"`);
      }
      return {
        productId: product.id,
        name: product.name,
        qty: input.qty,
        price: Number(product.price),
        packed: false,
      };
    });

    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product) continue;
      await this.recordStockChange(
        store.id,
        product,
        product.stock - item.qty,
        `Buyurtma`,
      );
    }

    const totalPrice = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    const order = await this.orderRepo.save(
      this.orderRepo.create({
        storeId: store.id,
        customerId,
        items,
        totalPrice,
        deliveryAddress: dto.deliveryAddress,
        deliveryLat: dto.deliveryLat,
        deliveryLng: dto.deliveryLng,
        deliveryMode: dto.deliveryMode ?? MarketOrderDeliveryMode.PLATFORM,
        paymentMethod: dto.paymentMethod ?? MarketPaymentMethod.CASH,
        customerPhone,
        note: dto.note ?? null,
        status: MarketOrderStatus.NEW,
      }),
    );

    this.realtimeGateway.emitToUser(store.ownerUserId, 'market:order:created', {
      orderId: order.id,
      storeId: store.id,
    });

    return order;
  }

  /**
   * A customer's own market order history (GET /market/orders).
   *
   * Was an unbounded read of every order the customer ever placed, each one then
   * fanned out into a `withDelivery` lookup — so the number of queries grew with
   * the history too.
   *
   * The response stays a bare array: the Flutter client hits `/market/orders`
   * and decodes a list, so an envelope would break it. Pagination is therefore
   * opt-in via query parameters, and a caller that sends none keeps the previous
   * behaviour for any realistic history (newest CUSTOMER_ORDERS_DEFAULT_LIMIT).
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

  adminListStores(): Promise<Store[]> {
    return this.storeRepo.find({ relations: ['owner'], order: { createdAt: 'DESC' } });
  }

  async adminCreateStore(dto: CreateStoreAdminDto): Promise<Store> {
    const owner = await this.usersService.createWithRole(
      dto.phone,
      UserRole.MARKET,
      dto.firstName,
      dto.lastName,
    );
    return this.storeRepo.save(
      this.storeRepo.create({
        ownerUserId: owner.id,
        name: dto.storeName,
        phone: dto.storePhone ?? dto.phone,
        address: dto.storeAddress ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        status: StoreStatus.ACTIVE,
      }),
    );
  }

  async adminSetStoreStatus(id: string, status: StoreStatus): Promise<Store> {
    const store = await this.storeRepo.findOne({ where: { id } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    store.status = status;
    return this.storeRepo.save(store);
  }

  // Content moderation — an admin reviewing products across every store, not
  // scoped to a single vendor's own catalog (see listProducts for that).
  adminListProducts(): Promise<Product[]> {
    return this.productRepo.find({ relations: ['store'], order: { createdAt: 'DESC' } });
  }

  async adminDeleteProduct(id: string): Promise<void> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    await this.productRepo.remove(product);
  }
}
