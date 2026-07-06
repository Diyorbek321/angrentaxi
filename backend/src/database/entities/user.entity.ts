import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  PASSENGER = 'passenger',
  DRIVER = 'driver',
  MANAGER = 'manager',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
  // A driver who just self-registered a profile — awaiting admin approval.
  // Passengers/managers/admins are never PENDING; they go ACTIVE immediately.
  PENDING = 'pending',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true, type: 'varchar', length: 50 })
  firstName: string | null;

  @Column({ nullable: true, type: 'varchar', length: 50 })
  lastName: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PASSENGER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ nullable: true, type: 'varchar', length: 300 })
  blockReason: string | null;

  @Column({ nullable: true, type: 'varchar' })
  fcmToken: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
