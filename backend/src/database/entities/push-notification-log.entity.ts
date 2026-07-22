import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum BroadcastAudience {
  ALL = 'all',
  CUSTOMERS = 'customers',
  DRIVERS = 'drivers',
}

// Durable record of an admin-composed broadcast push (Super Admin > Marketing
// > Push Notifications). Written once per broadcast, after NotificationsService
// has attempted delivery to every matching user's FCM token.
@Entity('push_notification_logs')
export class PushNotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  body: string;

  @Column({ type: 'enum', enum: BroadcastAudience })
  audience: BroadcastAudience;

  @Column({ name: 'sent_count', type: 'int', default: 0 })
  sentCount: number;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
