import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum StoreDeliveryMode {
  SELF = 'self',
  PLATFORM = 'platform',
}

export enum StoreStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
}

@Entity('stores')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { eager: false })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User;

  @Column({ name: 'owner_user_id', unique: true })
  ownerUserId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ nullable: true, type: 'varchar' })
  phone: string | null;

  @Column({ nullable: true, type: 'varchar' })
  address: string | null;

  // Unused legacy column, superseded by lat/lng below (plain decimals are
  // simpler to read/write than PostGIS geometry for a single static point).
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: string | null;

  // Pickup point for courier dispatch (see MarketService.dispatchDelivery).
  // Nullable until the vendor sets it in Settings; dispatch is skipped
  // (with a clear error) if either is missing.
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
    },
  })
  lat: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
    },
  })
  lng: number | null;

  @Column({ name: 'working_hours_start', type: 'varchar', default: '08:00' })
  workingHoursStart: string;

  @Column({ name: 'working_hours_end', type: 'varchar', default: '22:00' })
  workingHoursEnd: string;

  @Column({
    type: 'enum',
    enum: StoreDeliveryMode,
    default: StoreDeliveryMode.PLATFORM,
    name: 'delivery_mode',
  })
  deliveryMode: StoreDeliveryMode;

  @Column({ name: 'low_stock_threshold', type: 'int', default: 10 })
  lowStockThreshold: number;

  // Platform commission on gross revenue (percent), settable per-store like
  // Restaurant.commissionRate / Driver.commissionRate.
  @Column({
    name: 'commission_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 10.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  commissionRate: number;

  @Column({
    type: 'enum',
    enum: StoreStatus,
    default: StoreStatus.ACTIVE,
  })
  status: StoreStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
