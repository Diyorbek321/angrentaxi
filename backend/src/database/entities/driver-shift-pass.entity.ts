import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum DriverShiftPassStatus {
  ACTIVE = 'active',
  /** `ends_at` o'tgan — o'qishda ham shunday hisoblanadi (`shift-pass-policy.ts`). */
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * Haydovchining kunlik smenasi (migratsiya 026). Smena davomida qamralgan
 * xizmat turlaridagi safarlardan komissiya olinmaydi.
 *
 * `driver_id` — `users.id` (haydovchi FOYDALANUVCHISI), `orders.driver_id`
 * va `transactions.user_id` bilan bir xil kalit.
 *
 * `service_types` — sotib olingan paytdagi sozlamaning NUSXASI: admin keyin
 * ro'yxatni o'zgartirsa, allaqachon to'langan smena qamrovi o'zgarmaydi.
 */
@Index('idx_driver_shift_passes_driver_ends', ['driverId', 'endsAt'])
@Index('idx_driver_shift_passes_starts', ['startsAt'])
@Check('CHK_driver_shift_passes_window', '"ends_at" > "starts_at"')
@Entity('driver_shift_passes')
export class DriverShiftPass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: { to: (value: number) => value, from: (value: string) => parseFloat(value) },
  })
  price: number;

  @Column({ type: 'varchar', length: 10, default: DriverShiftPassStatus.ACTIVE })
  status: DriverShiftPassStatus;

  @Column({ name: 'service_types', type: 'jsonb', default: () => `'["taxi"]'` })
  serviceTypes: string[];

  /** Hamyondan yechilgan DEBIT qatori (`external_id = 'shift_pass_<id>'`). */
  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  /** Admin bekor qilgan payt (migratsiya 027). */
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'cancel_reason', type: 'varchar', length: 500, nullable: true })
  cancelReason: string | null;

  /** Hamyonga qaytarilgan summa (`shift_pass_refund_<id>` CREDIT); qaytarilmagan bo'lsa `null`. */
  @Column({
    name: 'refund_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
    },
  })
  refundAmount: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
