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

export enum SosReporterRole {
  PASSENGER = 'passenger',
  DRIVER = 'driver',
}

export enum SosAlertStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
}

// Emergency/SOS alert raised by a passenger or driver mid-trip (Yandex-Go-style
// panic button). Persisted so dispatchers have a durable record beyond the
// realtime 'sos:alert' socket event (see SafetyService.reportSos), and so the
// active list survives a manager reconnecting/refreshing the dashboard.
@Entity('sos_alerts')
export class SosAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { eager: false })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  // User.id of whoever triggered the alert (either the order's passenger or
  // its driver — see SafetyService.reportSos for the membership check).
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'reported_by_user_id' })
  reportedByUser: User;

  @Column({ name: 'reported_by_user_id', type: 'uuid' })
  reportedByUserId: string;

  @Column({ name: 'reported_by_role', type: 'varchar' })
  reportedByRole: SosReporterRole;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  lat: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  lng: number;

  @Column({ type: 'varchar', default: SosAlertStatus.ACTIVE })
  status: SosAlertStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;
}
