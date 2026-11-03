import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Kim qachon kimga "ilova orqali qo'ng'iroq" so'radi (INCIDENT-POLICY §4, migratsiya 051). */
export type CallerRole = 'passenger' | 'driver';

@Index('idx_order_call_logs_order_created', ['orderId', 'createdAt'])
@Index('idx_order_call_logs_created', ['createdAt'])
@Entity('order_call_logs')
export class OrderCallLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'caller_user_id', type: 'uuid' })
  callerUserId: string;

  @Column({ name: 'caller_role', type: 'varchar', length: 20 })
  callerRole: CallerRole;

  @Column({ name: 'callee_user_id', type: 'uuid', nullable: true })
  calleeUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
