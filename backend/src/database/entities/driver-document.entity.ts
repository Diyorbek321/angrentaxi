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

export enum DriverDocumentType {
  LICENSE_FRONT = 'license_front',
  LICENSE_BACK = 'license_back',
  PASSPORT = 'passport',
  VEHICLE_REGISTRATION = 'vehicle_registration',
}

export enum DriverDocumentReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// KYC document uploaded by a driver during/after onboarding (license, passport,
// vehicle registration). Additive to the text-only carModel/carNumber fields on
// Driver — this table just tracks file references + admin review state.
// DriverDocumentsService.listForDriver reads a single driver's documents on
// every KYC screen open and on every admin review; no query filters on
// review_status alone, so no index for it.
@Index('idx_driver_documents_driver_id', ['driverId'])
@Entity('driver_documents')
export class DriverDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Driver, { eager: false })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @Column({
    type: 'enum',
    enum: DriverDocumentType,
  })
  documentType: DriverDocumentType;

  @Column({ type: 'varchar' })
  fileUrl: string;

  @Column({
    type: 'enum',
    enum: DriverDocumentReviewStatus,
    default: DriverDocumentReviewStatus.PENDING,
  })
  reviewStatus: DriverDocumentReviewStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;
}
