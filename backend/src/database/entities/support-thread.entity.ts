import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum SupportThreadStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

// One persistent thread per user (passenger or driver) — get-or-created via
// SupportService.getOrCreateForUser, reopened rather than duplicated if the
// user messages again after an operator closes it.
// Read-path indexes.
// - user_id: getOrCreateForUser runs a findOne by user_id on every support
//   screen open and every message send.
// - status + last_message_at: the operator inbox, which lists threads by
//   status sorted on last_message_at DESC.
@Index('idx_support_threads_user_id', ['userId'])
@Index('idx_support_threads_status_last_message_at', ['status', 'lastMessageAt'])
@Entity('support_threads')
export class SupportThread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 20, name: 'user_role' })
  userRole: 'passenger' | 'driver';

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'varchar', length: 20, default: SupportThreadStatus.OPEN })
  status: SupportThreadStatus;

  @ManyToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: 'assigned_manager_id' })
  assignedManager: User | null;

  @Column({ name: 'assigned_manager_id', type: 'uuid', nullable: true })
  assignedManagerId: string | null;

  @Column({ name: 'last_read_at_user', type: 'timestamptz', nullable: true })
  lastReadAtUser: Date | null;

  @Column({ name: 'last_read_at_operator', type: 'timestamptz', nullable: true })
  lastReadAtOperator: Date | null;

  // Denormalized for cheap "sort threads by recency" without a join+max() on messages.
  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
