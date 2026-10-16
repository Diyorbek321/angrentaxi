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
import { Driver } from './driver.entity';
import { IntercityRoute } from './intercity-route.entity';

const decimal = {
  to: (value: number) => value,
  from: (value: string) => parseFloat(value),
};

/** Qatnov klassi — tarif darajalari nomi bilan bir xil (Start / Comfort). */
export enum IntercityTripClass {
  START = 'start',
  COMFORT = 'comfort',
}

/**
 * Qatnov holati.
 *
 *  open → full (barcha o'rindiq band yoki butun mashina olingan) →
 *  boarding (haydovchi yo'lovchilarni yig'yapti) → in_progress (yo'lda) →
 *  completed. Har qanday "yo'lga chiqmagan" holatdan → cancelled.
 *
 * `full` → `open` ga qaytishi mumkin: yo'lovchi bandini bekor qilsa, joy
 * bo'shaydi (4-qadam).
 */
export enum IntercityTripStatus {
  OPEN = 'open',
  FULL = 'full',
  BOARDING = 'boarding',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/** Haydovchining boshqa qatnov e'lon qilishiga to'sqinlik qiladigan holatlar. */
export const INTERCITY_TRIP_LIVE_STATUSES: readonly IntercityTripStatus[] = [
  IntercityTripStatus.OPEN,
  IntercityTripStatus.FULL,
  IntercityTripStatus.BOARDING,
  IntercityTripStatus.IN_PROGRESS,
];

/**
 * Haydovchi e'lon qilgan shaharlararo qatnov.
 *
 * O'rindiq HISOBI shu qatorda, band qilishning o'zi esa `orders` qatori
 * (`orders.intercity_trip_id`). Pul (komissiya, 1% ushlash, fiskal chek)
 * buyurtma bo'yicha ishlaydi — shu sababli har yo'lovchi alohida buyurtma.
 *
 * ⚠️ `driverId` — `drivers.id`. `orders.driver_id` esa `users.id`! Band
 * qilishda buyurtmaga `driver.userId` yoziladi, bu ustun emas.
 *
 * ⚠️ BAND QILISH ATOMIK BO'LADI (4-qadam): o'qib-tekshirib-yozish emas,
 * bitta shartli UPDATE —
 *
 *   UPDATE intercity_trips SET seats_taken = seats_taken + :n, status = …
 *    WHERE id = :id AND status = 'open' AND NOT whole_car_booked
 *      AND seats_taken + :n <= seats_total AND departure_at > now()
 *   RETURNING *
 *
 * 0 qator → joy qolmagan (409). Butun mashina — xuddi shu, `seats_taken = 0`
 * sharti bilan. Ikki yo'lovchi oxirgi joyni bir vaqtda olsa, Postgres qator
 * qulfi ularni ketma-ket qiladi va ikkinchisi 0 qator oladi. CHECK
 * (`seats_taken <= seats_total`) — oxirgi himoya chizig'i.
 *
 * Narxlar yo'nalishdan e'lon paytida NUSXALANADI: admin narxni keyinroq
 * o'zgartirsa, yo'lovchi ko'rgan narx o'zgarmaydi.
 */
@Index('idx_intercity_trips_route_status_departure', ['routeId', 'status', 'departureAt'])
@Index('idx_intercity_trips_driver_status', ['driverId', 'status'])
@Check('chk_intercity_trips_seats_taken', '"seats_taken" >= 0 AND "seats_taken" <= "seats_total"')
@Check('chk_intercity_trips_seats_total', '"seats_total" BETWEEN 1 AND 8')
@Check('chk_intercity_trips_class', `"class" IN ('start', 'comfort')`)
@Check(
  'chk_intercity_trips_status',
  `"status" IN ('open', 'full', 'boarding', 'in_progress', 'completed', 'cancelled')`,
)
@Check('chk_intercity_trips_prices_positive', '"seat_price" > 0 AND "whole_car_price" > 0')
@Entity('intercity_trips')
export class IntercityTrip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @ManyToOne(() => IntercityRoute, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'route_id', foreignKeyConstraintName: 'fk_intercity_trips_route' })
  route?: IntercityRoute;

  /** `drivers.id` (users.id EMAS). */
  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @ManyToOne(() => Driver, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'driver_id', foreignKeyConstraintName: 'fk_intercity_trips_driver' })
  driver?: Driver;

  @Column({ name: 'class', type: 'varchar', length: 10, default: IntercityTripClass.START })
  tripClass: IntercityTripClass;

  @Column({ name: 'departure_at', type: 'timestamptz' })
  departureAt: Date;

  @Column({ name: 'seats_total', type: 'int' })
  seatsTotal: number;

  @Column({ name: 'seats_taken', type: 'int', default: 0 })
  seatsTaken: number;

  /** Butun mashina olingan — o'rindiq bandi endi mumkin emas. */
  @Column({ name: 'whole_car_booked', type: 'boolean', default: false })
  wholeCarBooked: boolean;

  @Column({ type: 'varchar', length: 16, default: IntercityTripStatus.OPEN })
  status: IntercityTripStatus;

  /** Klass bo'yicha yo'nalishdan nusxa — bitta o'rindiq, so'm. */
  @Column({ name: 'seat_price', type: 'decimal', precision: 12, scale: 2, transformer: decimal })
  seatPrice: number;

  /** Klass bo'yicha yo'nalishdan nusxa — butun mashina, so'm. */
  @Column({ name: 'whole_car_price', type: 'decimal', precision: 12, scale: 2, transformer: decimal })
  wholeCarPrice: number;

  @Column({ name: 'cancel_reason', type: 'varchar', length: 500, nullable: true })
  cancelReason: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'departed_at', type: 'timestamptz', nullable: true })
  departedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
