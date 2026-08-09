import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds the invite-a-friend referral program: every user gets a short unique
// referral code, and can be tagged with the user who referred them (set at
// most once, enforced in ReferralsService rather than at the DB level). Like
// 002-013, dev environments run with DB_SYNC on; this documents the
// production path.
export class Referrals1700000000014 implements MigrationInterface {
  name = 'Referrals1700000000014';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code varchar(10);
    `);
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id uuid;
    `);

    // Backfill existing rows with a generated code. A 6-char slice of an md5
    // hash gives ~16M combinations, so a collision among the handful of MVP
    // rows this backfill runs against is an acceptable risk — new users going
    // forward get their code via a proper unique-checked retry loop in
    // application code (see generateUniqueReferralCode).
    await queryRunner.query(`
      UPDATE users
      SET referral_code = upper(substring(md5(random()::text || id::text), 1, 6))
      WHERE referral_code IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_users_referral_code'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT "UQ_users_referral_code" UNIQUE (referral_code);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_referred_by_user_id" ON users (referred_by_user_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_referred_by_user_id";
    `);
    await queryRunner.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS "UQ_users_referral_code";
    `);
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS referred_by_user_id;
    `);
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS referral_code;
    `);
  }
}
