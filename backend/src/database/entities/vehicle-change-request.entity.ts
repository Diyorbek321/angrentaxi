import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Driver } from './driver.entity';

export enum VehicleChangeRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/** The vehicle fields a driver may ask to change. */
export interface VehicleFields {
  carModel: string | null;
  carNumber: string | null;
  licensePlate: string | null;
  carYear: number | null;
  vehicleType: string | null;
}

/**
 * A verified driver asking to change the car on their profile.
 *
 * Kept apart from `drivers` for the same reason tariff edits are: the car a
 * passenger is told to look for comes straight from `drivers.car_number`, so a
 * change must not be live until someone has checked it. The previous values
 * are snapshotted so the reviewer sees a before/after that cannot drift.
 */
@Index('idx_vehicle_change_requests_status_created', ['status', 'createdAt'])
@Index('idx_vehicle_change_requests_driver', ['driverId'])
@Entity('vehicle_change_requests')
export class VehicleChangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Driver, { eager: false })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @Column({ type: 'jsonb' })
  proposed: VehicleFields;

  @Column({ type: 'jsonb' })
  previous: VehicleFields;

  @Column({
    type: 'enum',
    enum: VehicleChangeRequestStatus,
    enumName: 'vehicle_change_requests_status_enum',
    default: VehicleChangeRequestStatus.PENDING,
  })
  status: VehicleChangeRequestStatus;

  @Column({ name: 'review_note', type: 'varchar', length: 500, nullable: true })
  reviewNote: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
