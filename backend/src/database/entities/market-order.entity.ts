import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { User } from './user.entity';

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

export interface MarketOrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  packed: boolean;
}

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
