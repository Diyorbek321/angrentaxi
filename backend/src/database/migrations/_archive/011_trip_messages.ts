import { MigrationInterface, QueryRunner } from 'typeorm';

// Per-trip chat messages between a passenger and driver, scoped to a single
// order (see TripMessage entity / trip-chat module). Distinct from
// support_messages (007/008 predate this — that table is the persistent
// user<->operator support thread). Like 002-008, dev environments run with
// DB_SYNC on; this documents the production path.
export class TripMessages1700000000011 implements MigrationInterface {
  name = 'TripMessages1700000000011';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS trip_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id),
        sender_id UUID NOT NULL REFERENCES users(id),
        sender_role VARCHAR(20) NOT NULL,
        body VARCHAR(500) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_trip_messages_order_id ON trip_messages(order_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS trip_messages;
    `);
  }
}
