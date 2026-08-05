import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('otps')
export class Otp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Every OTP lookup (send, verify, cleanup) filters on phone, so this is the
  // hot path for the table.
  @Index('idx_otps_phone')
  @Column()
  phone: string;

  @Column()
  code: string;

  @Column({ default: false })
  isUsed: boolean;

  // Wrong-code guesses made against this OTP. Once it reaches
  // AuthService.MAX_OTP_ATTEMPTS the row is burned (isUsed = true), so a
  // 6-digit code cannot be brute-forced within its 5-minute lifetime.
  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
