import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Order } from './order.entity';

// Audit trail for manual driver assignment/reassignment (OrdersService.reassignDriver).
// Under the automated-dispatch model, MatchingService is the only path that
// assigns a driver during normal operation — this endpoint is now reserved
// for exception handling (no drivers found, SOS, a driver's car breaking
// down mid-trip, etc.), so every use is required to carry a reason and gets
// a durable record here rather than disappearing into a REST log line.
@Entity('dispatch_overrides')
export class DispatchOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { eager: false })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  // User.id of the manager/admin who performed the override.
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'performed_by_user_id' })
  performedByUser: User;

  @Column({ name: 'performed_by_user_id', type: 'uuid' })
  performedByUserId: string;

  // Driver.userId the order was taken from, if any (null for a first-time
  // manual assign rather than a reassignment).
  @Column({ name: 'previous_driver_id', type: 'uuid', nullable: true })
  previousDriverId: string | null;

  // Driver.userId the order was given to.
  @Column({ name: 'new_driver_id', type: 'uuid' })
  newDriverId: string;

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
