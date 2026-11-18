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

export enum DriverVerificationReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Haydovchi yuborgan bitta material (hujjat skani yoki avtomobil fotosi).
 *
 * Qatorlar ATAYLAB o'chirilmaydi va ustiga yozilmaydi: har yuborish yangi
 * qator. Shuning uchun "qachon nima yuborilgan, kim tasdiqlagan" tarixi
 * to'liq qoladi — nizo chiqqanda (masalan haydovchi "men yuborgandim"
 * desa) javob beradigan yagona joy shu.
 *
 * NEGA `code` chet el kaliti emas, satr: qoida qatori o'chirilsa yoki
 * qayta yaratilsa ham eski yuborilgan materiallar bog'liqligini yo'qotmaydi
 * va o'chirish kaskadga aylanmaydi.
 */
// Eng ko'p bajariladigan ikki so'rov:
//  - bitta haydovchining har bir `code` i bo'yicha ENG OXIRGI yuborilgani
//    (holat hisoblash, har `GET /drivers/me/verification` da);
//  - ko'rilmagan materiallar navbati (menejer paneli).
@Index('idx_driver_verification_submissions_driver_code', [
  'driverId',
  'code',
  'submittedAt',
])
@Index('idx_driver_verification_submissions_review_status', ['reviewStatus', 'submittedAt'])
@Entity('driver_verification_submissions')
export class DriverVerificationSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Bog'lanish e'lon qilingan, lekin `eager: false` — holat hisoblashda
  // haydovchi obyekti allaqachon qo'lda bo'ladi. Relation'ning o'zi kerak,
  // aks holda dev'dagi `synchronize` migratsiya qo'ygan chet el kalitini
  // o'chirib yuborardi va ikki muhit ajralib ketardi.
  @ManyToOne(() => Driver, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  // `driver_verification_requirements.code` ga mos keladi.
  @Column({ type: 'varchar', length: 100 })
  code: string;

  // Saqlash manzili, ochiq URL EMAS: pasport skani ham shu jadvalga tushadi,
  // shuning uchun fayl faqat ruxsat tekshiradigan endpoint orqali beriladi.
  @Column({ name: 'file_url', type: 'varchar' })
  fileUrl: string;

  @Column({
    name: 'review_status',
    type: 'varchar',
    length: 20,
    default: DriverVerificationReviewStatus.PENDING,
  })
  reviewStatus: DriverVerificationReviewStatus;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  // Tasdiqlangan paytda `now + cadenceDays` dan hisoblanadi.
  // `null` = muddatsiz (`cadenceDays = 0`, ya'ni bir martalik talab).
  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date | null;
}
