import { MigrationInterface, QueryRunner } from 'typeorm';

// Audit trail for manual driver assignment/reassignment — see
// DispatchOverride entity for the rationale (automated-dispatch model: this
// endpoint is now an exception path, not the default flow, so every use is
// required to carry a reason and a durable record). Dev environments run
// with DB_SYNC on; this documents the production path.
export class DispatchOverrides1700000000017 implements MigrationInterface {
  name = 'DispatchOverrides1700000000017';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS dispatch_overrides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id),
        performed_by_user_id UUID NOT NULL REFERENCES users(id),
        previous_driver_id UUID,
        new_driver_id UUID NOT NULL,
        reason VARCHAR(500) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_dispatch_overrides_order_id ON dispatch_overrides (order_id);
      CREATE INDEX IF NOT EXISTS idx_dispatch_overrides_created_at ON dispatch_overrides (created_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS dispatch_overrides CASCADE;`);
  }
}
