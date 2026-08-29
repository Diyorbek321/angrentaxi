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
import { FareBreakdown } from '../../modules/tariffs/fare-breakdown';

export enum OrderStatus {
  /**
   * Yo'lovchi safarni KELAJAKDAGI vaqtga rejalashtirgan.
   *
   * Bu holatda haydovchi qidirilmaydi: buyurtma `scheduled_at` vaqti
   * yaqinlashguncha kutib turadi, so'ng `ScheduledOrdersService` uni
   * `CREATED` ga o'tkazadi va aynan o'shanda `matching.startSearch`
   * chaqiriladi. Alohida holat kerak, chunki "kutayotgan reja" bilan
   * "hozir haydovchi izlanayotgan buyurtma" ni bitta holat bilan
   * ifodalab bo'lmaydi — dispetcher taxtasi, bekor qilish qoidalari va
   * cron so'rovi uchtasi ham ularni ajrata olishi kerak.
   */
  SCHEDULED = 'scheduled',
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
// - status + scheduled_at: ScheduledOrdersService cron'i HAR DAQIQADA
//   `WHERE status='scheduled' AND scheduled_at <= :cutoff` deb so'raydi.
//   Bu indekssiz har tick to'liq jadval skani bo'lardi — va jadval
//   tugagan safarlar bilan cheksiz o'sadi, ya'ni sekinlashuv vaqt o'tishi
//   bilan yomonlashadigan turdan.
@Index('idx_orders_status_scheduled_at', ['status', 'scheduledAt'])
// - city_id + created_at: hisobotning shahar kesimi va menejer panelidagi
//   "shu shahar buyurtmalari" filtri. Ko'p shaharli bo'lgach har bir
//   hisobot so'rovi shu ustundan boshlanadi.
@Index('idx_orders_city_id_created_at', ['cityId', 'createdAt'])
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

  // ---------------------------------------------------------------------
  // CHEK VA CHAQIM
  // ---------------------------------------------------------------------

  /**
   * Safar tugagan lahzadagi narx tarkibi, muzlatib yozilgan.
   *
   * Chekni jonli tarifdan qayta hisoblab BO'LMAYDI: tarif keyin o'zgarsa,
   * o'sha safar cheki boshqa raqam ko'rsatardi. Eski safarlarda `null` —
   * chek ekrani buni "tarkib mavjud emas" deb ko'rsatadi va soxta tarkib
   * o'ylab topmaydi.
   */
  @Column({ name: 'fare_breakdown', type: 'jsonb', nullable: true })
  fareBreakdown: FareBreakdown | null;

  /**
   * Safar tugagan aniq vaqt.
   *
   * `updatedAt` chek sanasi bo'la OLMAYDI — undan keyingi har qanday yozuv
   * (masalan `PaymentsService.settleOrderPayout`) uni surib yuboradi.
   */
  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  /**
   * Haydovchi olish nuqtasiga YETIB KELGAN lahza (ARRIVED holatiga o'tish).
   *
   * Kutish haqi shu lahzadan safar boshlanishigacha hisoblanadi. NEGA server
   * tomonda saqlanadi: ilgari kutish hisoblagichi faqat haydovchi ilovasida,
   * LOKAL edi — ekran ochilganda boshlanardi, ilova qayta ishga tushsa nolga
   * qaytardi, yo'lovchi esa uni umuman ko'rmasdi. Ya'ni ikki tomon har xil
   * raqam ko'rardi va o'sha raqamning pulga aloqasi yo'q edi. Endi ikkala
   * ilova ham AYNAN shu maydondan hisoblaydi.
   *
   * ⚠️ BIR MARTA yoziladi: `driverArrived`
   * `COALESCE("arrived_at", :arrivedAt)` qiladi, ya'ni tugma ikki marta
   * bosilsa vaqt QAYTA yozilmaydi — aks holda haydovchi kutish hisobini
   * nolga tushira olardi.
   *
   * ⚠️ Vaqt SQL `NOW()` dan EMAS, Node'dagi `new Date()` dan olinadi va
   * parametr sifatida bog'lanadi. Sabab: kutish daqiqalari shu maydon bilan
   * `trips.start_time` (u ham JS `Date`) AYIRMASI. Ikkalasi bitta soatdan
   * chiqishi shart — baza va Node vaqt mintaqasi farq qilganda `NOW()`
   * kutishni soatlab noto'g'ri hisoblardi.
   *
   * ⚠️ Haydovchi almashtirilganda (`reassignDriver`) ATAYLAB `null` ga
   * qaytariladi: yangi haydovchi hali kelmagan, oldingisining kutgan vaqti
   * esa yo'lovchidan undirilmasligi kerak.
   *
   * Eski buyurtmalarda `null` — kutish 0, hisob-kitob o'zgarmaydi.
   */
  @Column({ name: 'arrived_at', type: 'timestamp', nullable: true })
  arrivedAt: Date | null;

  /**
   * Narx QAT'IYmi (yo'lovchiga ko'rsatilgan summa bilan bir xilmi).
   *
   * `true`  — yo'lovchi manzilni xaritada belgilagan, ya'ni marshrut oldindan
   *           ma'lum. Bunda safar oxirida `fare_breakdown` dagi QUOTE YO'L
   *           HAQI sifatida aynan undiriladi: tirbandlik ham, uzunroq yo'l
   *           ham summani o'zgartirmaydi.
   * `false` — manzil oldindan ma'lum emas, narx haqiqiy bosib o'tilgan
   *           masofadan hisoblanadi (hisoblagich rejimi).
   *
   * ⚠️ KAFOLAT MARSHRUTGA TEGISHLI, KUTISHGA EMAS. Qat'iy narxli safarda ham
   * kutish haqi ALOHIDA qo'shiladi (`arrivedAt` ga qarang), ya'ni undiriladigan
   * summa `quote.total + waitingFare` bo'lishi mumkin. Sababi: qat'iy narx
   * haydovchi boshqarmaydigan noaniqlikni (yo'l, tirbandlik) yopadi; kutish esa
   * YO'LOVCHI boshqaradigan xarajat. Yo'lovchiga ko'rsatiladigan va'da shunga
   * mos bo'lishi SHART: "narx belgilangan, kutish alohida".
   *
   * ⚠️ Ilgari bunday ajratish yo'q edi va uchta har xil masofa ishlatilardi:
   * yo'lovchiga OSRM yo'l masofasi ko'rsatilardi, buyurtma esa HAVERSINE
   * (to'g'ri chiziq) bo'yicha yaratilardi, yakunda yana boshqacha
   * hisoblanardi. Ya'ni "ko'rsatilgan narx" hech qayerda saqlanmasdi ham.
   */
  @Column({ name: 'is_fixed_price', type: 'boolean', default: false })
  isFixedPrice: boolean;

  /**
   * Buyurtma yaratilgan paytdagi hudud koeffitsienti.
   *
   * Ilgari u `OrdersCreationService` da hisoblanib, narxga qo'shilib,
   * TASHLAB YUBORILARDI — natijada chekda "nega qimmat?" savoliga javob
   * beradigan hech narsa qolmasdi.
   */
  @Column({
    name: 'surge_multiplier',
    type: 'decimal',
    precision: 4,
    scale: 2,
    default: 1.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  surgeMultiplier: number;

  /**
   * Yo'lovchi bergan chaqim. `null` = chaqim berilmagan (0 emas — mavjud
   * `discountAmount`/`driverEarning` bilan bir xil konventsiya).
   *
   * ⚠️ Chaqim KOMISSIYASIZ — to'liq haydovchiga o'tadi, shuning uchun u
   * `driverEarning` ga QO'SHILMAYDI: u yerda komissiya ayirilgan sof yo'l
   * haqi turadi va aralashtirilsa daromad hisoboti buziladi.
   */
  @Column({
    name: 'tip_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value !== null ? parseFloat(value) : null),
    },
  })
  tipAmount: number | null;

  /**
   * Chaqim qanday to'langani. Safarning o'z `paymentMethod` idan MUSTAQIL:
   * yo'l naqd bo'lib, chaqim hamyondan berilishi mumkin.
   */
  @Column({
    name: 'tip_payment_method',
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  tipPaymentMethod: PaymentMethod | null;

  /** Idempotentlik va hisobot uchun. */
  @Column({ name: 'tip_paid_at', type: 'timestamp', nullable: true })
  tipPaidAt: Date | null;

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

  /**
   * Rejalashtirilgan olib ketish vaqti. `null` = "hozir" (odatdagi buyurtma).
   *
   * ⚠️ TIP `timestamptz`, `timestamp` EMAS. Loyihada `TZ` sozlanmagan va
   * `@CreateDateColumn` mintaqasiz `TIMESTAMP` hosil qiladi — agar bu ustun
   * ham shunday bo'lsa, O'zbekiston (UTC+5) da rejalashtirilgan safar 5
   * soatga surilib ketardi. Mobil ilova UTC ISO yuboradi, ko'rsatishda
   * `.toLocal()` qiladi. Precedent: `promo_code.entity.ts`,
   * `support-thread.entity.ts`.
   *
   * ⚠️ NARX HAQIDA — ATAYLAB QILINGAN TANLOV: narx buyurtma BERILGAN
   * lahzada qotiriladi (`fare_breakdown` + `is_fixed_price`), safar
   * bajariladigan paytda QAYTA HISOBLANMAYDI. Ya'ni ertalab buyurtma
   * berilgan safar kechqurun tirbandlikda bajarilsa, o'sha paytdagi hudud
   * koeffitsienti yuqori bo'lishi mumkin, lekin yo'lovchidan ko'rsatilgan
   * summa undiriladi — farqni platforma ko'taradi. Buning aksi ham
   * to'g'ri: yo'lovchi rejalashtirgan paytda surge yuqori bo'lsa, u
   * o'sha yuqori narxni to'laydi. Sabab — ishonch: yo'lovchiga
   * ko'rsatilgan raqam bilan undiriladigan raqam HAR DOIM bir xil
   * bo'lishi kerak.
   */
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  /**
   * Buyurtma qaysi shaharda yaratilgan — OLISH NUQTASIDAN aniqlanadi.
   *
   * ⚠️ FOYDALANUVCHI TANLAMAYDI. Qo'lda tanlash yana bir xato manbai
   * bo'lardi: odam ro'yxatdan "Angren" ni tanlab, Toshkentdan buyurtma
   * berishi mumkin. Koordinatadan aniqlangan shahar esa har doim rost.
   *
   * `null` — ikki xil holatda: (1) jadvalda birorta faol shahar yo'q, ya'ni
   * qamrov cheklovi umuman qo'llanilmayapti; (2) shahar qatori keyinchalik
   * o'chirilgan (`ON DELETE SET NULL`). Ikkalasi ham buyurtmaning o'zi
   * uchun ma'nosiz — ustun faqat hisobot va filtr uchun.
   */
  @Column({ name: 'city_id', type: 'uuid', nullable: true })
  cityId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
