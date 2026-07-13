import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds multi-stop ride support: an ordered list of intermediate waypoints
// between pickup and dropoff. Like 002-008, dev environments run with
// DB_SYNC on; this documents the production path.
export class OrderWaypoints1700000000010 implements MigrationInterface {
  name = 'OrderWaypoints1700000000010';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS waypoints jsonb;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders DROP COLUMN IF EXISTS waypoints;
    `);
  }
}
