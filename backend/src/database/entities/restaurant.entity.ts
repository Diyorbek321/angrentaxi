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

export enum RestaurantStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
}

export interface WorkingHoursDay {
  day: string;
  open: boolean;
  from: string;
  to: string;
}

export interface RestaurantNotifications {
  sound: boolean;
  push: boolean;
  sms: boolean;
}

@Entity('restaurants')
export class Restaurant {
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

  // Pickup point for courier dispatch (see FoodService.dispatchDelivery).
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

  // One row per weekday — matches the mockup's per-day hours editor exactly.
  @Column({ type: 'jsonb' })
  hours: WorkingHoursDay[];

  @Column({ name: 'delivery_radius_km', type: 'int', default: 7 })
  deliveryRadiusKm: number;

  // Platform commission on gross revenue (percent). Defaults to the
  // mockup's flat 15% — settable per-restaurant like Driver.commissionRate.
  @Column({
    name: 'commission_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 15.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  commissionRate: number;

  @Column({ type: 'jsonb', default: { sound: true, push: true, sms: false } })
  notifications: RestaurantNotifications;

  @Column({
    type: 'enum',
    enum: RestaurantStatus,
    default: RestaurantStatus.ACTIVE,
  })
  status: RestaurantStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
