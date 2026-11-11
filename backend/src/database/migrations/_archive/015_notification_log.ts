import { MigrationInterface, QueryRunner } from 'typeorm';

// Persisted history of push notifications sent via NotificationsService
// (see NotificationLog entity) — backs the mobile app's in-app notifications
// list (GET /notifications). Like 002-012, dev environments run with DB_SYNC
// on; this documents the production path.
export class NotificationLog1700000000015 implements MigrationInterface {
  name = 'NotificationLog1700000000015';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        body VARCHAR(500) NOT NULL,
        event VARCHAR(50) NOT NULL,
        read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS notification_logs;
    `);
  }
}
