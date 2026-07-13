import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { User } from './user.entity';

// Per-trip chat between the passenger and driver of a single order — scoped
// and ephemeral, unlike SupportMessage/SupportThread which is one persistent
// thread per user with an operator. Broadcast live via
// RealtimeGateway.emitToOrder (order:${orderId} room), which clients already
// join/leave via the existing join:order / leave:order socket events used
// for driver-location updates.
@Entity('trip_messages')
export class TripMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { eager: false })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  // Stored literally at send time (mirrors SupportMessage.senderRole) so
  // history stays accurate even if the sender's account role ever changes.
  @Column({ type: 'varchar', length: 20, name: 'sender_role' })
  senderRole: 'passenger' | 'driver';

  @Column({ type: 'varchar', length: 500 })
  body: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
