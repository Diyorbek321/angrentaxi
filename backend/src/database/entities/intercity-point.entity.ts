import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

const decimal = {
  to: (value: number) => value,
  from: (value: string) => parseFloat(value),
};

/**
 * Shaharlararo yo'nalish uchi (Angren, Rohat krugi (Toshkent), Olmaliq...).
 *
 * ⚠️ NEGA `City` EMAS: `cities` — shahar ichidagi taksi qamrovi. Toshkentni
 * u yerga qo'shish Toshkentda shahar taksisini ham ochib yuborardi
 * (migratsiya 034 izohiga qarang). Bu jadval faqat shaharlararo uchun.
 *
 * Markaz + radius: yo'lovchini olish/tushirish manzili shu doira ichida
 * bo'lishi shart — "Rohat krugi (Toshkent)" nuqtasi aylanmaning o'zini,
 * butun Toshkentni emas, anglatadi.
 */
@Index('idx_intercity_points_is_active_sort_order', ['isActive', 'sortOrder'])
@Check(
  'chk_intercity_points_extension_non_negative',
  `"extension_max_km" >= 0 AND "extension_price_per_km" >= 0 AND ("extension_comfort_price_per_km" IS NULL OR "extension_comfort_price_per_km" >= 0)`,
)
@Entity('intercity_points')
export class IntercityPoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'center_lat', type: 'decimal', precision: 10, scale: 7, transformer: decimal })
  centerLat: number;

  @Column({ name: 'center_lng', type: 'decimal', precision: 10, scale: 7, transformer: decimal })
  centerLng: number;

  @Column({ name: 'radius_km', type: 'decimal', precision: 6, scale: 2, transformer: decimal })
  radiusKm: number;

  // Faol emas = yangi yo'nalishga tanlab bo'lmaydi. Qator O'CHIRILMAYDI —
  // unga bog'langan yo'nalishlar va qatnovlar tarixi ma'nosini yo'qotmasin.
  /**
   * "Shahar ichiga davom" (`intercity-extension.ts`, migratsiya 038): nuqta
   * markazidan shu km gacha (to'g'ri chiziq) manzilga eltish/olish mumkin,
   * yo'l km uchun haq bilan. 0 — davom o'chiq.
   */
  @Column({ name: 'extension_max_km', type: 'decimal', precision: 6, scale: 2, default: 0, transformer: decimal })
  extensionMaxKm: number;

  /** Start, so'm/km. */
  @Column({ name: 'extension_price_per_km', type: 'int', default: 0 })
  extensionPricePerKm: number;

  /** Comfort, so'm/km; null — Start narxi. */
  @Column({ name: 'extension_comfort_price_per_km', type: 'int', nullable: true })
  extensionComfortPricePerKm: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
