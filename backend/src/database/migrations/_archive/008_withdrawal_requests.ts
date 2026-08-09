import { MigrationInterface, QueryRunner } from 'typeorm';

// Driver wallet withdrawal (payout) requests — MVP/skeleton flow, see
// PaymentsController/PaymentsService for the approve/reject/paid lifecycle.
// Like 002-007, dev environments run with DB_SYNC on; this documents the
// production path (now required, since synchronize defaults OFF in
// production per db-synchronize.util.ts).
export class WithdrawalRequests1700000000008 implements MigrationInterface {
  name = 'WithdrawalRequests1700000000008';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE withdrawal_requests_status_enum AS ENUM (
          'pending', 'approved', 'rejected', 'paid'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id UUID NOT NULL REFERENCES users(id),
        amount DECIMAL(10, 2) NOT NULL,
        status withdrawal_requests_status_enum NOT NULL DEFAULT 'pending',
        payout_destination VARCHAR NOT NULL,
        requested_at TIMESTAMP NOT NULL DEFAULT now(),
        processed_at TIMESTAMP,
        admin_note VARCHAR
      );

      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_driver_id ON withdrawal_requests(driver_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS withdrawal_requests;
      DROP TYPE IF EXISTS withdrawal_requests_status_enum;
    `);
  }
}
