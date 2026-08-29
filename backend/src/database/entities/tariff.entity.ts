import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Transport turi — `tariffs.vehicle_type` va `drivers.vehicle_type` AYNAN shu
 * to'plamdan oziqlanadi.
 *
 * NEGA bitta manba: matching haydovchining imkoniyatini tarifning talabiga
 * qiyoslaydi. Agar qiymatlar ikki joyda alohida yozilsa, bir tomonda 'van',
 * ikkinchisida 'furgon' paydo bo'lishi mumkin va filtr JIMGINA hech kimni
 * topolmay qoladi — buyurtma xatosiz, lekin haydovchisiz qoladi.
 *
 * `null` (enum a'zosi emas) — yengil avtomobil, ya'ni taksi. Shuning uchun
 * taksi tariflarida ham, taksi haydovchilarida ham ustun bo'sh turadi.
 */
export enum VehicleType {
  VAN = 'van',
  SMALL_TRUCK = 'small_truck',
  LARGE_TRUCK = 'large_truck',
}

// `findAll(serviceType, cityId)` filtri: `(city_id IS NULL OR city_id = :id)`
// faol tariflar ichidan tanlanadi.
@Index('idx_tariffs_city_id_is_active', ['cityId', 'isActive'])
@Entity('tariffs')
export class Tariff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // Which vertical this tariff belongs to: 'taxi' | 'cargo' (food/market later).
  @Column({ name: 'service_type', type: 'varchar', default: 'taxi' })
  serviceType: string;

  // For cargo: 'van' | 'small_truck' | 'large_truck'. Null for taxi.
  // Matching uses this as the required vehicle for the order — a driver is
  // only offered the ride when Driver.vehicleType is exactly this value.
  @Column({ name: 'vehicle_type', type: 'varchar', nullable: true })
  vehicleType: VehicleType | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  basePrice: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  pricePerKm: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  pricePerMin: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  minPrice: number;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 1,
    default: 1.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  surgeMultiplier: number;

  // Upper cap on the computed price; null = unbounded (preserves pre-existing behavior).
  @Column({
    name: 'max_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value !== null ? parseFloat(value) : null),
    },
  })
  maxPrice: number | null;

  /**
   * BEPUL kutish oynasi, daqiqa. Haydovchi "keldim" belgilagan lahzadan
   * boshlanadi (`orders.arrived_at`).
   *
   * ⚠️ Migratsiya `009_waiting_charge` bu ustunni DEFAULT 3 bilan qo'shadi va
   * mavjud tariflarni darhol to'ldiradi — admin panelda kutish maydonlari
   * paydo bo'lishini kutmasdan, barcha tariflar ishlaydigan qiymat bilan
   * yashaydi.
   */
  @Column({ name: 'free_wait_minutes', type: 'int', default: 3 })
  freeWaitMinutes: number;

  /**
   * Bepul oynadan keyingi har bir BOSHLANGAN daqiqa narxi, so'm.
   *
   * ⚠️ NEGA `int`, boshqa narx ustunlari kabi `decimal` EMAS. Qiymat butun
   * so'mda (500), va u butun songa (daqiqaga) ko'paytiriladi — ya'ni natija
   * ham har doim butun so'm. `int` saqlash float yaxlitlash xatosi paydo
   * bo'ladigan yagona yo'lni umuman yopadi va `parseFloat` transformerini
   * ham keraksiz qiladi. So'mning tiyini yo'q, ya'ni kasr qism kutish haqi
   * uchun hech qanday ma'no bermaydi.
   */
  @Column({ name: 'waiting_price_per_minute', type: 'int', default: 500 })
  waitingPricePerMinute: number;

  @Column({ default: true })
  isActive: boolean;

  // Ordinal rank among taxi tariffs (1 = Start ... 5 = Biznes) — a driver may
  // serve any tariff at or below their Driver.approvedTariffTier. Meaningless
  // for cargo tariffs (vehicleType set instead), left at the default there.
  @Column({ name: 'tier', type: 'int', default: 1 })
  tier: number;

  // Minimum manufacture year a driver's car must meet to be considered for
  // this tariff, informational only — the actual gate on matching is
  // Driver.approvedTariffTier, which a manager sets after reviewing the car
  // (mirrors Yandex Pro's model: public criteria, per-driver manual vetting).
  @Column({ name: 'min_car_year', type: 'int', nullable: true })
  minCarYear: number | null;

  /**
   * Tarif qaysi shaharga tegishli. `null` = BARCHA shaharlarda amal qiladi.
   *
   * ⚠️ `null` NING MA'NOSI SHU YERDA HAL QILINGAN: ko'p shaharlilik
   * qo'shilgunga qadar yaratilgan har bir tarifda bu ustun bo'sh bo'ladi,
   * va ular hech qayerda yo'qolmasligi SHART. Shuning uchun `findAll`
   * cityId bilan chaqirilganda shart `(city_id = :cityId OR city_id IS
   * NULL)` — "shu shaharniki VA hamma joyniki". Teskarisi (NULL ni
   * "hech qayerda" deb o'qish) migratsiyadan keyin butun narx ro'yxatini
   * bo'shatib qo'yardi.
   */
  @Column({ name: 'city_id', type: 'uuid', nullable: true })
  cityId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
