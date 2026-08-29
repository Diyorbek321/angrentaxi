import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ServiceType } from './order.entity';
import { VehicleType } from './tariff.entity';

/** Talab qilinadigan material turi — mobil ilova ikkisini har xil ko'rsatadi. */
export enum DriverVerificationKind {
  DOCUMENT = 'document',
  VEHICLE_PHOTO = 'vehicle_photo',
}

/**
 * Haydovchidan nima talab qilinishining YAGONA manbai.
 *
 * ⚠️ ENG MUHIM ARXITEKTURA QARORI: `code` — ERKIN SATR, enum EMAS, va
 * `label`/`hint` ham shu yerda turadi. Mobil ilova ro'yxatni FAQAT serverdan
 * oladi va o'zi hech narsa taxmin qilmaydi (tarjima jadvali ham yo'q).
 * Sababi oddiy: talablar ro'yxati o'zgarishi kutilmoqda. Ro'yxat ilovada
 * qattiq kodlansa, har bir yangi foto turi uchun yangi APK chiqarish va
 * do'kon ko'rigini kutish kerak bo'lardi. Bu yerda esa yangi talab =
 * jadvalga bitta qator, hech qanday kod o'zgarmaydi va hech kim yangilanish
 * kutmaydi.
 *
 * NEGA `kind`, `service_type`, `vehicle_type` `varchar` (PG enum emas):
 * `drivers.vehicle_type` va `tariffs.service_type` allaqachon `varchar`, va
 * PG enum'ga yangi qiymat qo'shish migratsiya tranzaksiyasi ichida
 * ishlatilmaydi (005 dagi izohga qarang). Yangi transport turi qo'shilishi
 * — kutilayotgan o'zgarish, u migratsiya muammosiga aylanmasligi kerak.
 */
@Index('idx_driver_verification_requirements_active_sort', ['isActive', 'sortOrder'])
@Entity('driver_verification_requirements')
export class DriverVerificationRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Barqaror mashina o'qiydigan kalit, masalan `vehicle_photo_front`.
  // Yuborilgan materiallar shu satr orqali bog'lanadi (chet el kaliti emas),
  // shuning uchun qoida qatori o'chib ketsa ham tarix yo'qolmaydi.
  @Column({ type: 'varchar', length: 100, unique: true })
  code: string;

  // Foydalanuvchiga ko'rinadigan matn — SERVERDAN keladi.
  @Column({ type: 'varchar', length: 200 })
  label: string;

  // Ixtiyoriy ko'rsatma ("Davlat raqami ko'rinsin"). `null` bo'lishi mumkin.
  @Column({ type: 'varchar', length: 300, nullable: true })
  hint: string | null;

  @Column({ type: 'varchar', length: 30, default: DriverVerificationKind.DOCUMENT })
  kind: DriverVerificationKind;

  // `null` = xizmat turidan qat'i nazar hammaga tegishli.
  @Column({ name: 'service_type', type: 'varchar', length: 30, nullable: true })
  serviceType: ServiceType | null;

  // `null` = transport turidan qat'i nazar hammaga tegishli.
  @Column({ name: 'vehicle_type', type: 'varchar', length: 30, nullable: true })
  vehicleType: VehicleType | null;

  // Necha kunda bir qayta yuborilishi kerak. `0` = bir martalik (muddatsiz),
  // `7` = haftalik, `30` = oylik. Tasdiqlangan paytda `valid_until` shu
  // qiymatdan hisoblanadi.
  @Column({ name: 'cadence_days', type: 'int', default: 0 })
  cadenceDays: number;

  // Muddat o'tgandan keyin haydovchi hali ham onlayn chiqa oladigan kunlar
  // soni. Bu shunchaki "yumshoqlik" emas: yangi qoida qo'shilganda butun
  // parkni bir zumda oflayn qilib qo'ymaslikning asosiy vositasi
  // (`driver-verification.service.ts#computeBlockDeadline` ga qarang).
  @Column({ name: 'grace_days', type: 'int', default: 0 })
  graceDays: number;

  // `false` = tavsiya etiladi, lekin onlayn chiqishni bloklamaydi.
  @Column({ name: 'is_required', type: 'boolean', default: true })
  isRequired: boolean;

  // O'chirish o'rniga shu bayroq ishlatiladi — tarix (yuborilgan fayllar)
  // saqlanib qoladi va qoida keyin qayta yoqilishi mumkin.
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  // ⚠️ Majburlash hisobining boshlanish nuqtasi. Qoida QACHON paydo
  // bo'lgani bilinmasa, "qoidadan oldingi holat uchun jarima yo'q" qoidasini
  // umuman hisoblab bo'lmaydi.
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
