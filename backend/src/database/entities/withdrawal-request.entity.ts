import {
  Column,
  CreateDateColumn,
  Entity,
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

// MVP payout request record. No bank/mobile-money automation is wired up —
// a driver files a request, an admin reviews it out-of-band, and manually
// marks it 'paid' once the transfer has actually been sent (see
// PaymentsController for the flow notes).
@Entity('withdrawal_requests')
export class WithdrawalRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // User.id of the driver (same convention as Transaction.userId /
  // DriverBonusAward.driverId — not the Driver profile's own id).
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  @Column({ name: 'driver_id' })
  driverId: string;

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
}
