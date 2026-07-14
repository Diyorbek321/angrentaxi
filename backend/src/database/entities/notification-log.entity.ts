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

// Durable record of every push notification NotificationsService attempts to
// send (see notify* methods) — written regardless of whether the user has an
// fcmToken, so the mobile in-app notifications list has something to show
// even when push delivery itself was skipped/failed. `event` mirrors the
// `event` field already embedded in each push's data payload (e.g.
// 'order_accepted', 'driver_arrived', 'trip_completed', 'new_order_offer',
// 'order_cancelled', 'support_reply').
@Entity('notification_logs')
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  body: string;

  @Column({ type: 'varchar', length: 50 })
  event: string;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
