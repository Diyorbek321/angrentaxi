import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ServiceType } from './order.entity';
import { VehicleType } from './tariff.entity';

// Read-path indexes.
// - user_id: DriversService.findByUserId is on the hot path of every driver
//   request (auth -> driver profile) and of order accept/complete. The
//   relation is @OneToOne but is not declared unique at the DB level, so
//   nothing creates this index implicitly.
// - is_online + updated_at: countOnline() for the dashboard and the
//   dispatcher roster's `isOnline` filter, which sorts by updated_at DESC.
//   Matching itself does not hit this table by is_online — MatchingService
//   resolves nearby drivers from the Redis geo set and then looks each one
//   up by primary key.
@Index('idx_drivers_user_id', ['userId'])
@Index('idx_drivers_is_online_updated_at', ['isOnline', 'updatedAt'])
// - city_id: menejer panelidagi shahar bo'yicha haydovchi ro'yxati.
//   ⚠️ Matching bu indeksdan foydalanmaydi (cityId izohiga qarang).
@Index('idx_drivers_city_id', ['cityId'])
@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ nullable: true, type: 'varchar' })
  carModel: string | null;

  @Column({ nullable: true, type: 'varchar' })
  carNumber: string | null;

  @Column({ nullable: true, type: 'varchar' })
  licensePlate: string | null;

  // Manufacture year, self-reported at application time — informational
  // input to the manager's tariff-tier review, not itself enforced anywhere.
  @Column({ name: 'car_year', type: 'int', nullable: true })
  carYear: number | null;

  // Highest Tariff.tier this driver may be matched against (1 = Start ...
  // 5 = Biznes). A manager sets this after reviewing carYear/photos — new
  // drivers default to 1 (Start only) until vetted higher, mirroring Yandex
  // Pro's "check with your partner manager" model.
  @Column({ name: 'approved_tariff_tier', type: 'int', default: 1 })
  approvedTariffTier: number;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 5.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  rating: number;

  @Column({ default: false })
  isOnline: boolean;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  balance: number;

  // Per-driver commission override (percent, e.g. 5 for a driver carrying ads
  // who pays a reduced rate). Null means "use the platform default rate".
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
    },
  })
  commissionRate: number | null;

  // Haydovchi qaysi transportda ishlaydi — `Tariff.vehicleType` bilan BIR XIL
  // to'plam (VehicleType), chunki matching ikkalasini tenglikka solishtiradi.
  //
  // `null` = yengil avtomobil (taksi). Bu bo'shliq emas, MA'NOLI qiymat:
  // cargo tariflari doim aniq bir turni talab qiladi, shuning uchun
  // `vehicleType` null haydovchiga yuk buyurtmasi hech qachon bormaydi —
  // bu aynan tuzatilayotgan nuqson (furgon buyurtmasi sedanga ketishi).
  @Column({ name: 'vehicle_type', type: 'varchar', nullable: true })
  vehicleType: VehicleType | null;

  // Haydovchi qabul qiladigan xizmat turlari (taxi/cargo/food/market).
  //
  // ⚠️ ORQAGA MOSLIK: bu ustun paydo bo'lishidan oldin ro'yxatdan o'tgan
  // haydovchilarda u bo'sh bo'lishi mumkin (masalan `synchronize` ustunni
  // DEFAULT'siz yaratib qo'ygan bazada). BO'SH ro'yxat "hech nima qabul
  // qilmaydi" degani EMAS — `resolveDriverServiceTypes` uni `['taxi']` deb
  // o'qiydi. Aks holda migratsiyadan keyin birorta taksi buyurtmasi ham
  // taqsimlanmay qolardi: butun shahar bir zumda "haydovchi topilmadi" ga
  // aylanardi.
  @Column({ name: 'service_types', type: 'jsonb', default: () => `'["taxi"]'` })
  serviceTypes: ServiceType[];

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  currentLocation: string | null;

  /**
   * Haydovchining ASOSIY shahri — profil yaratilganda joriy joylashuvidan
   * aniqlanadi, aniqlanmasa `null`.
   *
   * ⚠️ MATCHING BU USTUNNI ISHLATMAYDI VA ISHLATMASLIGI KERAK.
   * `MatchingService` nomzodlarni Redis geo to'plamidan RADIUS bo'yicha
   * topadi — ya'ni "yaqinlik" allaqachon masofa bilan o'lchangan. Bu yerga
   * qo'shimcha shahar filtri qo'yilsa, shahar chegarasidan bir necha yuz
   * metr narida turgan, olish nuqtasiga esa eng yaqin haydovchi KERAKSIZ
   * ravishda kesib tashlanardi — buyurtma esa haydovchisiz qolardi.
   *
   * Bu ustun FAQAT hisobot va boshqaruv uchun: menejer panelida
   * "shu shaharning haydovchilari" ro'yxati, shahar kesimidagi statistika.
   * Agar kelajakda kimdir "unutilgan filtr" deb matching'ga qo'shmoqchi
   * bo'lsa — bu izoh aynan shuning uchun yozilgan: bu unutilgan emas,
   * ATAYLAB yo'q.
   */
  @Column({ name: 'city_id', type: 'uuid', nullable: true })
  cityId: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
