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
import { IntercityPoint } from './intercity-point.entity';

const decimal = {
  to: (value: number) => value,
  from: (value: string) => parseFloat(value),
};

const nullableDecimal = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : parseFloat(value)),
};

/**
 * Shaharlararo yo'nalish va uning QAT'IY narxlari.
 *
 * Har bir yo'nalish alohida qator: Angren→Toshkent va Toshkent→Angren narxi
 * farq qilishi mumkin (masalan, ertalabki oqim bir tomonga kuchli).
 *
 * Narx to'rtta: o'rindiq va butun mashina × Start va Comfort klass
 * (tarif darajalari nomi bilan bir xil). Comfort
 * juftligi `NULL` — bu yo'nalishda komfort taklif qilinmaydi. Juftlik
 * yarim to'ldirilishi mumkin emas (CHECK + `intercity-route-policy.ts`):
 * "komfort o'rindiq bor, butun mashina narxi yo'q" holatida ilova nima
 * ko'rsatishini hech kim bilmasdi.
 *
 * Qatnov e'lon qilinganda narx yo'nalishdan NUSXALANADI (2-qadam) — admin
 * keyinroq narxni o'zgartirsa, allaqachon band qilingan joylar narxi
 * o'zgarmaydi.
 *
 * Narx nuqtaGACHA (masalan, "Rohat krugi (Toshkent)" aylanmasigacha).
 * TODO(intercity): nuqtadan nariga — shahar ichiga davom etish — alohida
 * narxlanadi (yo'nalish bo'yicha "shahar ichi davomi", nuqta radiusidan
 * tashqaridagi har km uchun). Hozircha qurilmagan: manzil nuqta doirasida
 * bo'lishi shart.
 */
@Index('uq_intercity_routes_origin_destination', ['originPointId', 'destinationPointId'], {
  unique: true,
})
@Index('idx_intercity_routes_is_active_sort_order', ['isActive', 'sortOrder'])
@Check('chk_intercity_routes_distinct_points', '"origin_point_id" <> "destination_point_id"')
@Check('chk_intercity_routes_prices_positive', '"seat_price" > 0 AND "whole_car_price" > 0')
@Check(
  'chk_intercity_routes_comfort_pair',
  '("comfort_seat_price" IS NULL) = ("comfort_whole_car_price" IS NULL)',
)
@Check(
  'chk_intercity_routes_comfort_positive',
  '"comfort_seat_price" IS NULL OR ("comfort_seat_price" > 0 AND "comfort_whole_car_price" > 0)',
)
@Entity('intercity_routes')
export class IntercityRoute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'origin_point_id', type: 'uuid' })
  originPointId: string;

  @ManyToOne(() => IntercityPoint, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'origin_point_id', foreignKeyConstraintName: 'fk_intercity_routes_origin_point' })
  originPoint?: IntercityPoint;

  @Column({ name: 'destination_point_id', type: 'uuid' })
  destinationPointId: string;

  @ManyToOne(() => IntercityPoint, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'destination_point_id',
    foreignKeyConstraintName: 'fk_intercity_routes_destination_point',
  })
  destinationPoint?: IntercityPoint;

  /** Start klass, bitta o'rindiq, so'm. */
  @Column({ name: 'seat_price', type: 'decimal', precision: 12, scale: 2, transformer: decimal })
  seatPrice: number;

  /** Start klass, butun mashina, so'm. */
  @Column({ name: 'whole_car_price', type: 'decimal', precision: 12, scale: 2, transformer: decimal })
  wholeCarPrice: number;

  @Column({
    name: 'comfort_seat_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: nullableDecimal,
  })
  comfortSeatPrice: number | null;

  @Column({
    name: 'comfort_whole_car_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: nullableDecimal,
  })
  comfortWholeCarPrice: number | null;

  /** Haydovchi qatnov e'lon qilganda taklif qilinadigan o'rindiqlar soni. */
  @Column({ name: 'seats_default', type: 'int', default: 4 })
  seatsDefault: number;

  // Faol emas = yo'lovchiga ko'rinmaydi, yangi qatnov e'lon qilib bo'lmaydi.
  // O'chirilmaydi — qatnovlar tarixi unga bog'langan.
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
