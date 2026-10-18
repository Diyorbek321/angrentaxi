import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IntercityRoute } from './intercity-route.entity';
import { IntercityTrip, IntercityTripClass } from './intercity-trip.entity';
import { IntercityBookingKind, Order } from './order.entity';
import { User } from './user.entity';
import type { FareBreakdown } from '../../modules/tariffs/fare-breakdown';

const decimal = {
  to: (value: number) => value,
  from: (value: string) => parseFloat(value),
};

/**
 *  open → accepted (haydovchi qabul qildi — band yaratildi)
 *  open → cancelled (yo'lovchi) | expired (oraliq tugadi, cron)
 */
export enum IntercityRequestStatus {
  OPEN = 'open',
  ACCEPTED = 'accepted',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

/**
 * Yo'lovchi so'rovlari doskasi — qatnov topmagan yo'lovchining so'rovi.
 *
 * Narx so'rov qoldirilgan lahzada MUZLATILADI (`fare_breakdown`, oshirishsiz):
 * yo'lovchi ko'rgan summa admin narxni keyin o'zgartirsa ham o'zgarmaydi.
 * Jami = `base_price` + `bonus`.
 *
 * Qabul qilinganda band odatdagidek `orders` qatori bo'ladi (komissiya, chek
 * buyurtma bo'yicha) — so'rov faqat unga ishora qiladi (`order_id`, `trip_id`).
 *
 * ⚠️ Bitta yo'lovchida bir vaqtda faqat BITTA ochiq so'rov (qisman unique
 * indeks): ikkitasini ikki haydovchi qabul qilsa, yo'lovchi bir vaqtda ikki
 * mashinaga yozilib qolardi.
 */
@Index('idx_intercity_requests_route_status_window', ['routeId', 'status', 'windowEnd'])
@Index('idx_intercity_requests_passenger', ['passengerId', 'createdAt'])
@Index('uq_intercity_requests_open_passenger', ['passengerId'], { unique: true, where: `"status" = 'open'` })
@Check('chk_intercity_requests_status', `"status" IN ('open', 'accepted', 'cancelled', 'expired')`)
@Check('chk_intercity_requests_class', `"class" IN ('start', 'comfort')`)
@Check('chk_intercity_requests_kind', `"kind" IN ('seat', 'whole_car')`)
@Check('chk_intercity_requests_seats', '"seats" BETWEEN 1 AND 8')
@Check('chk_intercity_requests_window', '"window_end" > "window_start"')
@Check('chk_intercity_requests_money', '"base_price" > 0 AND "bonus" >= 0')
@Entity('intercity_requests')
export class IntercityRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `users.id`. */
  @Column({ name: 'passenger_id', type: 'uuid' })
  passengerId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'passenger_id', foreignKeyConstraintName: 'fk_intercity_requests_passenger' })
  passenger?: User;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @ManyToOne(() => IntercityRoute, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'route_id', foreignKeyConstraintName: 'fk_intercity_requests_route' })
  route?: IntercityRoute;

  @Column({ name: 'class', type: 'varchar', length: 10, default: IntercityTripClass.START })
  tripClass: IntercityTripClass;

  @Column({ type: 'varchar', length: 12, default: IntercityBookingKind.SEAT })
  kind: IntercityBookingKind;

  /** Butun mashinada — yo'nalish standarti (`seats_default`). */
  @Column({ type: 'int', default: 1 })
  seats: number;

  @Column({ name: 'pickup_lat', type: 'decimal', precision: 10, scale: 7, transformer: decimal })
  pickupLat: number;

  @Column({ name: 'pickup_lng', type: 'decimal', precision: 10, scale: 7, transformer: decimal })
  pickupLng: number;

  @Column({ name: 'pickup_address', type: 'varchar', length: 300 })
  pickupAddress: string;

  @Column({ name: 'dropoff_lat', type: 'decimal', precision: 10, scale: 7, transformer: decimal })
  dropoffLat: number;

  @Column({ name: 'dropoff_lng', type: 'decimal', precision: 10, scale: 7, transformer: decimal })
  dropoffLng: number;

  @Column({ name: 'dropoff_address', type: 'varchar', length: 300 })
  dropoffAddress: string;

  @Column({ name: 'window_start', type: 'timestamptz' })
  windowStart: Date;

  @Column({ name: 'window_end', type: 'timestamptz' })
  windowEnd: Date;

  /** Qat'iy narx + shahar ichiga davom — oshirishsiz. */
  @Column({ name: 'base_price', type: 'decimal', precision: 12, scale: 2, transformer: decimal })
  basePrice: number;

  /** Yo'lovchi o'zi qo'shgan summa (faqat oshadi). */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimal })
  bonus: number;

  /** `base_price` tarkibi — qabul qilinganda bandga `bonus` bilan ko'chiriladi. */
  @Column({ name: 'fare_breakdown', type: 'jsonb' })
  fareBreakdown: FareBreakdown;

  @Column({ type: 'varchar', length: 12, default: IntercityRequestStatus.OPEN })
  status: IntercityRequestStatus;

  @Column({ name: 'trip_id', type: 'uuid', nullable: true })
  tripId: string | null;

  @ManyToOne(() => IntercityTrip, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trip_id', foreignKeyConstraintName: 'fk_intercity_requests_trip' })
  trip?: IntercityTrip | null;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @ManyToOne(() => Order, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id', foreignKeyConstraintName: 'fk_intercity_requests_order' })
  order?: Order | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
