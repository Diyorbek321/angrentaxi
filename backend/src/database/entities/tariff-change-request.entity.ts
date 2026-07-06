import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Tariff } from './tariff.entity';

export enum TariffChangeAction {
  CREATE = 'create',
  UPDATE = 'update',
}

export enum TariffChangeRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// A manager-proposed tariff create/edit awaiting admin approval. Kept as a
// separate table (not a status flag on Tariff) so a pending edit can never
// leak into live pricing — Tariff rows are read directly by calculatePrice()
// with no status filter.
@Entity('tariff_change_requests')
export class TariffChangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TariffChangeAction })
  action: TariffChangeAction;

  // Null when action = CREATE (proposing a brand-new tariff row).
  @ManyToOne(() => Tariff, { nullable: true, eager: false })
  @JoinColumn({ name: 'tariff_id' })
  tariff: Tariff | null;

  @Column({ name: 'tariff_id', type: 'uuid', nullable: true })
  tariffId: string | null;

  // Proposed field values, shaped like CreateTariffDto/UpdateTariffDto.
  @Column({ type: 'jsonb', name: 'proposed_changes' })
  proposedChanges: Record<string, unknown>;

  // Snapshot of the tariff's fields at proposal time (UPDATE only), so the
  // approval UI can show a before/after diff without it drifting if the live
  // tariff changes again before this request is reviewed.
  @Column({ type: 'jsonb', name: 'previous_values', nullable: true })
  previousValues: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: TariffChangeRequestStatus,
    default: TariffChangeRequestStatus.PENDING,
  })
  status: TariffChangeRequestStatus;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'proposed_by' })
  proposedByUser: User;

  @Column({ name: 'proposed_by' })
  proposedBy: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedByUser: User | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'review_note' })
  reviewNote: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'reviewed_at' })
  reviewedAt: Date | null;
}
