import { MigrationInterface, QueryRunner } from 'typeorm';

// OTP brute-force protection: counts wrong-code guesses per OTP row so
// AuthService can burn the code after 5 failures, plus the phone index every
// OTP lookup (send/verify/cleanup) relies on. Like 002-020, dev environments
// run with DB_SYNC on; this documents the production path.
export class OtpBruteForceProtection1700000000021 implements MigrationInterface {
  name = 'OtpBruteForceProtection1700000000021';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE otps ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_otps_phone ON otps (phone);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_otps_phone;
      ALTER TABLE otps DROP COLUMN IF EXISTS attempts;
    `);
  }
}
