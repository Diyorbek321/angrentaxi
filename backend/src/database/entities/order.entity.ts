import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Tariff } from './tariff.entity';
import { PromoCode } from './promo_code.entity';

export enum OrderStatus {
  CREATED = 'created',
  SEARCHING = 'searching',
  ACCEPTED = 'accepted',
  ARRIVED = 'arrived',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  WALLET = 'wallet',
}

// Super-app verticals. Taxi & cargo share the ride-hailing flow; food/market
// are reserved for the marketplace phase.
export enum ServiceType {
  TAXI = 'taxi',
  CARGO = 'cargo',
  FOOD = 'food',
  MARKET = 'market',
}

// Read-path indexes. Every hot orders query filters by owner or status and
// then sorts newest-first, so each index carries created_at as its trailing
// column: a single-column index on driver_id/passenger_id/status would still
// leave Postgres sorting the whole matched set on every page request.
// - driver_id + created_at: OrdersService.getDriverHistory, and the
//   driver_id/status/created_at earnings aggregates (getDriverEarningsToday,
//   getDriverEarningsForPeriod) which use the driver_id prefix.
// - passenger_id + created_at: OrdersService.getPassengerHistory, plus the
//   completed-rides loyalty count in completeTrip.
// - status + created_at: getActiveOrders (status IN + created_at DESC),
//   getAllOrders(status), getNoDriversFoundExceptions, and the
//   status+created_at dashboard counters.
// - created_at alone: the status-agnostic range scans in getReports and the
//   "orders today" dashboard counter.
@Index('idx_orders_driver_id_created_at', ['driverId', 'createdAt'])
@Index('idx_orders_passenger_id_created_at', ['passengerId', 'createdAt'])
@Index('idx_orders_status_created_at', ['status', 'createdAt'])
@Index('idx_orders_created_at', ['createdAt'])
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'passenger_id' })
  passenger: User;

  @Column({ name: 'passenger_id' })
  passengerId: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'driver_id' })
  driver: User | null;

  @Column({ name: 'driver_id', nullable: true, type: 'uuid' })
  driverId: string | null;

  @ManyToOne(() => Tariff, { eager: false })
  @JoinColumn({ name: 'tariff_id' })
  tariff: Tariff;

  @Column({ name: 'tariff_id' })
  tariffId: string;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  pickupLocation: string;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  dropoffLocation: string;

  @Column({ nullable: true, type: 'varchar' })
  pickupAddress: string | null;

  @Column({ nullable: true, type: 'varchar' })
  dropoffAddress: string | null;

  // Intermediate stops between pickup and dropoff, in visit order.
  @Column({ type: 'jsonb', nullable: true })
  waypoints: { address: string; lat: number; lng: number }[] | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  estimatedPrice: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value !== null ? parseFloat(value) : null),
    },
  })
  finalPrice: number | null;

  @ManyToOne(() => PromoCode, { nullable: true, eager: false })
  @JoinColumn({ name: 'promo_code_id' })
  promoCode: PromoCode | null;

  @Column({ name: 'promo_code_id', type: 'uuid', nullable: true })
  promoCodeId: string | null;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value !== null ? parseFloat(value) : null),
    },
  })
  discountAmount: number | null;

  // Amount credited to the driver for this order (finalPrice minus discount; no
  // commission deduction — see plan's explicit scoping-out of platform commission).
  @Column({
    name: 'driver_earning',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value !== null ? parseFloat(value) : null),
    },
  })
  driverEarning: number | null;

  @Column({
    type: 'enum',
    enum: ServiceType,
    default: ServiceType.TAXI,
    name: 'service_type',
  })
  serviceType: ServiceType;

  // Vertical-specific payload, e.g. cargo: { vehicleType, weightKg, loaders, cargoNote }.
  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.CREATED,
  })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
  })
  paymentMethod: PaymentMethod;

  @Column({ nullable: true, type: 'varchar' })
  note: string | null;

  @Column({ nullable: true, type: 'varchar' })
  cancelReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
