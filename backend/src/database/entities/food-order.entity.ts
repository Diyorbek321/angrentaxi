import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { User } from './user.entity';

export enum FoodOrderStatus {
  NEW = 'new',
  PREPARING = 'preparing',
  READY = 'ready',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum FoodPaymentMethod {
  CARD = 'card',
  CASH = 'cash',
}

export interface FoodOrderItem {
  dishId: string;
  name: string;
  qty: number;
  price: number;
  prepMinutes: number;
}

// Read-path indexes, mirroring MarketOrder.
// - restaurant_id + created_at: FoodService.listOrders / getDashboard /
//   getAnalytics (one restaurant's orders, newest-first).
// - restaurant_id + status: the kitchen board's status-filtered reads.
// - customer_id + created_at: FoodService.getMyOrders.
@Index('idx_food_orders_restaurant_id_created_at', ['restaurantId', 'createdAt'])
@Index('idx_food_orders_restaurant_id_status', ['restaurantId', 'status'])
@Index('idx_food_orders_customer_id_created_at', ['customerId', 'createdAt'])
@Entity('food_orders')
export class FoodOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Restaurant, { eager: false })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({
    type: 'enum',
    enum: FoodOrderStatus,
    default: FoodOrderStatus.NEW,
  })
  status: FoodOrderStatus;

  @Column({ type: 'jsonb' })
  items: FoodOrderItem[];

  @Column({ name: 'delivery_address', type: 'varchar' })
  deliveryAddress: string;

  // Dropoff point for courier dispatch (see FoodService.dispatchDelivery).
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

  // Set once a courier has been dispatched (vendor advanced to READY).
  // References orders.id — no formal FK since Order lives in a different
  // module/table family.
  @Column({ name: 'delivery_order_id', type: 'uuid', nullable: true })
  deliveryOrderId: string | null;

  @Column({ name: 'customer_phone', nullable: true, type: 'varchar' })
  customerPhone: string | null;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: FoodPaymentMethod,
    default: FoodPaymentMethod.CASH,
  })
  paymentMethod: FoodPaymentMethod;

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

  @Column({ name: 'reject_reason', nullable: true, type: 'varchar' })
  rejectReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
