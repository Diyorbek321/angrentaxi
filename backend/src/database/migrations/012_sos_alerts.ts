import { MigrationInterface, QueryRunner } from 'typeorm';

// Emergency/SOS alerts — passenger or driver panic-button reports raised
// mid-trip, surfaced to dispatchers in realtime (see SafetyService /
// RealtimeGateway.emitToManagers) and persisted here for the manager
// dashboard's active-alerts list. Like 002-008, dev environments run with
// DB_SYNC on; this documents the production path.
export class SosAlerts1700000000012 implements MigrationInterface {
  name = 'SosAlerts1700000000012';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sos_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id),
        reported_by_user_id UUID NOT NULL REFERENCES users(id),
        reported_by_role VARCHAR NOT NULL,
        lat DECIMAL(10, 7) NOT NULL,
        lng DECIMAL(10, 7) NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        resolved_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_sos_alerts_order_id ON sos_alerts(order_id);
      CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON sos_alerts(status);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS sos_alerts;
    `);
  }
}
