import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { SupportThread } from './support-thread.entity';

@Entity('support_messages')
export class SupportMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SupportThread, { eager: false })
  @JoinColumn({ name: 'thread_id' })
  thread: SupportThread;

  @Column({ name: 'thread_id' })
  threadId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'sender_id' })
  senderId: string;

  // Stored literally at send time (mirrors Rating.fromRole) rather than
  // re-derived from User.role later, so history stays accurate even if a
  // user's role ever changes.
  @Column({ type: 'varchar', length: 20, name: 'sender_role' })
  senderRole: 'passenger' | 'driver' | 'manager' | 'admin';

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
