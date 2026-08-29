import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum WithdrawalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAID = 'paid',
}

// Which kind of account filed this request — informational only (balance
// computation is generic per userId via Transaction.userId, see
// PaymentsService.computeBalance). Lets the admin payout queue tell driver,
// Market-vendor, and Eats-restaurant requests apart without joining out to
// stores/restaurants.
export enum WithdrawalOwnerType {
  DRIVER = 'driver',
  VENDOR = 'vendor',
  RESTAURANT = 'restaurant',
}

// MVP payout request record. No bank/mobile-money automation is wired up —
// the owner files a request, an admin reviews it out-of-band, and manually
// marks it 'paid' once the transfer has actually been sent (see
// PaymentsController for the flow notes).
// Read-path indexes; both payout queries sort by requested_at DESC, so it is
// the trailing column rather than a separate index.
// - driver_id + requested_at: PaymentsService.getMyWithdrawals (the
//   requester's own payout history).
// - status + requested_at: the admin payout queue, which lists all requests
//   filtered by status ('pending' first).
@Index('idx_withdrawal_requests_driver_id_requested_at', ['driverId', 'requestedAt'])
@Index('idx_withdrawal_requests_status_requested_at', ['status', 'requestedAt'])
@Entity('withdrawal_requests')
export class WithdrawalRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // User.id of the requester (same convention as Transaction.userId /
  // DriverBonusAward.driverId — not the Driver profile's own id). The
  // `driver`/`driverId` names are legacy from when only drivers could
  // withdraw — this now holds the requesting user's id regardless of
  // ownerType (driver, Market vendor, or Eats restaurant owner).
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  @Column({ name: 'driver_id' })
  driverId: string;

  @Column({
    name: 'owner_type',
    type: 'enum',
    enum: WithdrawalOwnerType,
    default: WithdrawalOwnerType.DRIVER,
  })
  ownerType: WithdrawalOwnerType;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  status: WithdrawalStatus;

  // Free-text payout target the driver wants the money sent to, e.g. a card
  // number or phone number for a mobile-money transfer. Intentionally not
  // validated/structured — MVP.
  @Column({ name: 'payout_destination', type: 'varchar' })
  payoutDestination: string;

  @CreateDateColumn({ name: 'requested_at' })
  requestedAt: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date | null;

  // Admin's note when approving/rejecting/marking paid (e.g. rejection reason).
  @Column({ name: 'admin_note', type: 'varchar', nullable: true })
  adminNote: string | null;

  /**
   * To'lov provayderi bergan o'tkazma identifikatori.
   *
   * ⚠️ `adminNote` dan ALOHIDA maydon: izoh odam yozadigan erkin matn,
   * bu esa tizim bergan raqam. Ularni bitta ustunga qo'shish keyinchalik
   * "qaysi o'tkazma?" degan savolga javob berishni matn ichidan qidirishga
   * aylantirardi.
   *
   * Qo'lda o'tkazmada `null` — hech qanday tizim raqam bermagan
   * (`ManualPayoutProvider` izohiga qarang).
   */
  @Column({ name: 'payout_reference', type: 'varchar', nullable: true })
  payoutReference: string | null;
}
