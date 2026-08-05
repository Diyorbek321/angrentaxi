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
import { SupportThread } from './support-thread.entity';

// Every message read is scoped to one thread and ordered by created_at
// (SupportService.getMessages), and the unread badge counts a thread's
// messages newer than a timestamp — both served by this composite.
@Index('idx_support_messages_thread_id_created_at', ['threadId', 'createdAt'])
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
