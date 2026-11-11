import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds an admin-facing rejection reason to KYC document review, so a driver
// whose document is rejected can see why (and what to fix on re-upload). Like
// 002-012, dev environments run with DB_SYNC on; this documents the
// production path.
export class DriverDocumentRejectionReason1700000000013 implements MigrationInterface {
  name = 'DriverDocumentRejectionReason1700000000013';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE driver_documents ADD COLUMN IF NOT EXISTS rejection_reason varchar(500);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE driver_documents DROP COLUMN IF EXISTS rejection_reason;
    `);
  }
}
