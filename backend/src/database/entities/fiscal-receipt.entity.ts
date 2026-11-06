import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Chekdagi komitent (principal) — pulning haqiqiy egasi. */
export enum FiscalPrincipalType {
  DRIVER = 'driver',
  RESTAURANT = 'restaurant',
  STORE = 'store',
  /** Platformaning o'z xizmati (masalan haydovchi smenasi) — komissioner emas, sotuvchi. */
  PLATFORM = 'platform',
}

export enum FiscalReceiptStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  /** Provayder sozlanmagan (`FISCAL_PROVIDER=noop`) — yozuv bor, chek yo'q. */
  SKIPPED = 'skipped',
}

/** Chek turi: sotuv yoki qaytarish (refund). Summa doim musbat — tur belgilaydi. */
export enum FiscalReceiptType {
  SALE = 'sale',
  REFUND = 'refund',
}

/** Onlayn-NKT modelida platformaning roli — komissioner (vositachi). */
export const FISCAL_PLATFORM_ROLE = 'komissioner';

/** Platforma o'z xizmatini sotganda (smena) — o'zi sotuvchi. */
export const FISCAL_PLATFORM_SELLER_ROLE = 'seller';

/**
 * Har bir yakunlangan buyurtma uchun fiskal chek yozuvi (migratsiya 025).
 *
 * Komissioner modeli: platforma pulni komitent (haydovchi / restoran /
 * do'kon) nomidan qabul qiladi. Chekda komitentning JShShIR/STIR bo'lishi
 * SHART — aks holda butun summa platforma aylanmasi hisoblanadi.
 *
 * `(order_id, receipt_type)` UNIKAL (migratsiya 028): bitta buyurtma — bitta
 * sotuv cheki va ko'pi bilan bitta qaytarish cheki. Taksi/yuk/posilka va
 * kuryer safari uchun bu `orders.id`; ovqat/market tovari uchun
 * `food_orders.id` / `market_orders.id` (UUID'lar jadvallar bo'ylab ham
 * to'qnashmaydi). Takroriy yozish — mavjud yozuv qaytadi (23505 ham ushlanadi).
 *
 * NEGA varchar (PG enum emas): 006 dagi sabab — qiymatlar kengayadi.
 */
@Index('uq_fiscal_receipts_order_type', ['orderId', 'receiptType'], { unique: true })
@Index('idx_fiscal_receipts_status_created', ['status', 'createdAt'])
@Entity('fiscal_receipts')
export class FiscalReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'receipt_type', type: 'varchar', length: 10, default: FiscalReceiptType.SALE })
  receiptType: FiscalReceiptType;

  /** Qaytarish chekida — asl sotuv cheki (`fiscal_receipts.id`), topilmasa null. */
  @Column({ name: 'original_receipt_id', type: 'uuid', nullable: true })
  originalReceiptId: string | null;

  @Column({ name: 'service_type', type: 'varchar', length: 20 })
  serviceType: string;

  @Column({ name: 'principal_type', type: 'varchar', length: 20 })
  principalType: FiscalPrincipalType;

  /** Haydovchi uchun `users.id`, sotuvchi uchun `restaurants.id`/`stores.id`. */
  @Column({ name: 'principal_id', type: 'uuid', nullable: true })
  principalId: string | null;

  @Column({ name: 'principal_pinfl', type: 'varchar', length: 14, nullable: true })
  principalPinfl: string | null;

  @Column({ name: 'principal_tin', type: 'varchar', length: 9, nullable: true })
  principalTin: string | null;

  @Column({ name: 'platform_role', type: 'varchar', length: 20, default: FISCAL_PLATFORM_ROLE })
  platformRole: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: { to: (value: number) => value, from: (value: string) => parseFloat(value) },
  })
  total: number;

  @Column({
    name: 'commission_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: { to: (value: number) => value, from: (value: string) => parseFloat(value) },
  })
  commissionAmount: number;

  /** `cash` | `card` (hamyon ham elektron to'lov — `card` deb yoziladi). */
  @Column({ name: 'payment_method', type: 'varchar', length: 10 })
  paymentMethod: string;

  @Column({ type: 'varchar', length: 10, default: FiscalReceiptStatus.PENDING })
  status: FiscalReceiptStatus;

  @Column({ type: 'varchar', length: 30 })
  provider: string;

  @Column({ name: 'external_id', type: 'varchar', length: 100, nullable: true })
  externalId: string | null;

  @Column({ name: 'fiscal_sign', type: 'varchar', length: 100, nullable: true })
  fiscalSign: string | null;

  @Column({ name: 'qr_url', type: 'varchar', length: 500, nullable: true })
  qrUrl: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
