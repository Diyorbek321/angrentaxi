import {
  AfterLoad,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { User } from './user.entity';
import {
  VendorWalletSettlementView,
  vendorWalletSettlementView,
} from './vendor-wallet-settlement-view';

export enum MarketOrderStatus {
  NEW = 'new',
  PACKING = 'packing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum MarketOrderDeliveryMode {
  SELF = 'self',
  PLATFORM = 'platform',
}

export enum MarketPaymentMethod {
  CASH = 'cash',
  CARD = 'card',
}

export interface MarketOrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  packed: boolean;
}

// Read-path indexes for the vendor panel and the customer's order list.
// - store_id + created_at: MarketService.listOrders / getDashboard /
//   getAnalytics, which all read one store's orders newest-first.
// - store_id + status: the status-filtered vendor order board
//   (`where: { storeId, status }`), where status is the selective part
//   within a single store.
// - customer_id + created_at: MarketService.getMyOrders.
@Index('idx_market_orders_store_id_created_at', ['storeId', 'createdAt'])
@Index('idx_market_orders_store_id_status', ['storeId', 'status'])
@Index('idx_market_orders_customer_id_created_at', ['customerId', 'createdAt'])
@Entity('market_orders')
export class MarketOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { eager: false })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ name: 'store_id' })
  storeId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({
    type: 'enum',
    enum: MarketOrderStatus,
    default: MarketOrderStatus.NEW,
  })
  status: MarketOrderStatus;

  @Column({ type: 'jsonb' })
  items: MarketOrderItem[];

  @Column({
    type: 'enum',
    enum: MarketOrderDeliveryMode,
    default: MarketOrderDeliveryMode.PLATFORM,
    name: 'delivery_mode',
  })
  deliveryMode: MarketOrderDeliveryMode;

  @Column({ name: 'delivery_address', type: 'varchar' })
  deliveryAddress: string;

  // Dropoff point for courier dispatch — required so a real Order can be
  // created against the ride-hailing pipeline (see MarketService.dispatchDelivery).
  @Column({
    name: 'delivery_lat',
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  deliveryLat: number;

  @Column({
    name: 'delivery_lng',
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  deliveryLng: number;

  // Set once a courier has been dispatched (store.deliveryMode === PLATFORM
  // and the vendor advanced to SHIPPED). References orders.id — no formal FK
  // since Order lives in a different module/table family.
  @Column({ name: 'delivery_order_id', type: 'uuid', nullable: true })
  deliveryOrderId: string | null;

  @Column({ name: 'customer_phone', nullable: true, type: 'varchar' })
  customerPhone: string | null;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: MarketPaymentMethod,
    default: MarketPaymentMethod.CASH,
  })
  paymentMethod: MarketPaymentMethod;

  @Column({
    name: 'total_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  totalPrice: number;

  @Column({ nullable: true, type: 'varchar' })
  note: string | null;

  // Naqd buyurtmada kuryer do'konga to'lashi (migratsiya 019,
  // `delivery/vendor-cash.ts`): to'ladi → sotuvchi tasdiqladi yoki nizo.
  @Column({ name: 'vendor_cash_paid_at', type: 'timestamptz', nullable: true })
  vendorCashPaidAt: Date | null;

  @Column({ name: 'vendor_cash_confirmed_at', type: 'timestamptz', nullable: true })
  vendorCashConfirmedAt: Date | null;

  @Column({ name: 'vendor_cash_disputed_at', type: 'timestamptz', nullable: true })
  vendorCashDisputedAt: Date | null;

  // Dispetcher nizoni yopdi (migratsiya 020). Izoh majburiy.
  @Column({ name: 'vendor_cash_dispute_resolved_at', type: 'timestamptz', nullable: true })
  vendorCashDisputeResolvedAt: Date | null;

  @Column({ name: 'vendor_cash_dispute_resolved_by', type: 'uuid', nullable: true })
  vendorCashDisputeResolvedBy: string | null;

  @Column({ name: 'vendor_cash_dispute_resolution', type: 'varchar', length: 500, nullable: true })
  vendorCashDisputeResolution: string | null;

  // Hamyon rejimida (migratsiya 026) kuryer hamyonidan sotuvchi hisobiga
  // o'tkazma qilingan payt. Qo'yilganda `vendorCashPaidAt` va
  // `vendorCashConfirmedAt` ham qo'yiladi — sotuvchi tasdig'i kerak emas.
  @Column({ name: 'vendor_wallet_settled_at', type: 'timestamptz', nullable: true })
  vendorWalletSettledAt: Date | null;

  // Olib ketilgandan keyin kuryer safari bekor qilinib, hamyon o'tkazmasi
  // teskari qilingan marta soni (migratsiya 027). Keyingi o'tkazma
  // qatorlari shu raqam bilan belgilanadi (`vendor-wallet-settlement.ts`):
  // birinchi o'tkazma `..._<id>`, qayta o'tkazma `..._<id>_2` va h.k.
  @Column({ name: 'vendor_wallet_reversal_count', type: 'int', default: 0 })
  vendorWalletReversalCount: number;

  // O'tkazma PAYTIDAGI summalar (migratsiya 029) — joriy komissiya stavkasidan
  // qayta hisoblanmaydi. Teskari qilinganda saqlanib qoladi, `reversed_at`
  // qo'yiladi. Ko'rinishi: `vendorWalletSettlement` (pastda).
  @Column({
    name: 'vendor_wallet_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
    },
  })
  vendorWalletAmount: number | null;

  @Column({
    name: 'vendor_wallet_commission',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
    },
  })
  vendorWalletCommission: number | null;

  @Column({ name: 'vendor_wallet_reversed_at', type: 'timestamptz', nullable: true })
  vendorWalletReversedAt: Date | null;

  /**
   * JSON'dagi `vendorWalletSettlement: { amount, commission, net, settledAt,
   * reversedAt, reversalCount } | null` — ustun emas, yuklanganda hisoblanadi.
   */
  vendorWalletSettlement?: VendorWalletSettlementView | null;

  @AfterLoad()
  // Ixtiyoriy (`?`): `{ ...order }` nusxalari ham shu tur bo'lib qolishi uchun.
  computeVendorWalletSettlement?(): void {
    this.vendorWalletSettlement = vendorWalletSettlementView(this);
  }

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
