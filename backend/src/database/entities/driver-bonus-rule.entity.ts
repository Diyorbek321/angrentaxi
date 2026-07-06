import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum BonusRuleType {
  // Award every `tripThreshold` completed trips (lifetime), repeating per tier.
  TRIP_COUNT = 'trip_count',
  // Award once per ISO week if trips-in-week >= tripThreshold.
  WEEKLY_GOAL = 'weekly_goal',
}

export enum BonusRuleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('driver_bonus_rules')
export class DriverBonusRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'enum', enum: BonusRuleType, name: 'rule_type' })
  ruleType: BonusRuleType;

  @Column({ type: 'integer', name: 'trip_threshold' })
  tripThreshold: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'bonus_amount',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  bonusAmount: number;

  // Optional scoping to a service type (e.g. 'taxi'); null = applies to all.
  @Column({ type: 'varchar', name: 'service_type', nullable: true })
  serviceType: string | null;

  @Column({ type: 'enum', enum: BonusRuleStatus, default: BonusRuleStatus.ACTIVE })
  status: BonusRuleStatus;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
