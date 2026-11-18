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
import { Order } from './order.entity';

/**
 * open      — passenger reported it, driver has not answered yet
 * found     — driver has the item; the dispatcher arranges the handover
 * not_found — driver checked the car and it is not there
 * returned  — handed back (dispatcher closes)
 * closed    — closed without a return (e.g. passenger gave up)
 */
export enum LostItemStatus {
  OPEN = 'open',
  FOUND = 'found',
  NOT_FOUND = 'not_found',
  RETURNED = 'returned',
  CLOSED = 'closed',
}

/**
 * Something a passenger left in the car.
 *
 * Its own table rather than a support message: it has a lifecycle the
 * dispatcher must be able to filter on ("found, not yet returned"), and it
 * involves the DRIVER, who has no access to the passenger's support thread.
 * The passenger's phone is never shown to the driver — the dispatcher
 * arranges the handover.
 */
@Index('idx_lost_item_reports_status_created', ['status', 'createdAt'])
@Index('idx_lost_item_reports_driver', ['driverUserId'])
@Entity('lost_item_reports')
export class LostItemReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { eager: false })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'passenger_id', type: 'uuid' })
  passengerId: string;

  /** users.id of the driver on that ride (orders.driver_id). */
  @Column({ name: 'driver_user_id', type: 'uuid' })
  driverUserId: string;

  @Column({ type: 'varchar', length: 500 })
  description: string;

  @Column({
    type: 'enum',
    enum: LostItemStatus,
    enumName: 'lost_item_reports_status_enum',
    default: LostItemStatus.OPEN,
  })
  status: LostItemStatus;

  @Column({ name: 'driver_note', type: 'varchar', length: 500, nullable: true })
  driverNote: string | null;

  @Column({ name: 'operator_note', type: 'varchar', length: 500, nullable: true })
  operatorNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
