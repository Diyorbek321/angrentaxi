import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { DriverBonusRule } from './driver-bonus-rule.entity';
import { Transaction } from './transaction.entity';

// Idempotency/audit index for bonus payouts. The money-of-record lives in
// Transaction (CREDIT rows); this table only prevents a rule from paying out
// twice for the same driver in the same period (trip-count tier or ISO week).
@Entity('driver_bonus_awards')
@Unique(['bonusRuleId', 'driverId', 'periodKey'])
export class DriverBonusAward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DriverBonusRule, { eager: false })
  @JoinColumn({ name: 'bonus_rule_id' })
  bonusRule: DriverBonusRule;

  @Column({ name: 'bonus_rule_id' })
  bonusRuleId: string;

  // User.id of the driver.
  @Column({ name: 'driver_id' })
  driverId: string;

  // e.g. "tier-3" (TRIP_COUNT) or "2026-W27" (WEEKLY_GOAL).
  @Column({ name: 'period_key', type: 'varchar' })
  periodKey: string;

  @ManyToOne(() => Transaction, { eager: false })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction;

  @Column({ name: 'transaction_id' })
  transactionId: string;

  @CreateDateColumn()
  awardedAt: Date;
}
