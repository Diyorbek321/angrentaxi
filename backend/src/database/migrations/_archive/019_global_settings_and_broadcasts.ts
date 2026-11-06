import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds: (1) platform-wide identity/support fields + a maintenance-mode flag
// to platform_settings (Super Admin "Global Settings" page — the flag is
// stored and toggleable but NOT enforced by a request-blocking guard yet,
// see PlatformSettings entity comment); (2) a durable log of admin broadcast
// push notifications (Super Admin "Push Notifications" page).
export class GlobalSettingsAndBroadcasts1700000000019 implements MigrationInterface {
  name = 'GlobalSettingsAndBroadcasts1700000000019';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE platform_settings
        ADD COLUMN IF NOT EXISTS platform_name VARCHAR NOT NULL DEFAULT 'Angren Taxi',
        ADD COLUMN IF NOT EXISTS support_phone VARCHAR NOT NULL DEFAULT '+998 71 200 00 00',
        ADD COLUMN IF NOT EXISTS support_email VARCHAR NOT NULL DEFAULT 'support@angrentaxi.uz',
        ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE broadcast_audience_enum AS ENUM ('all', 'customers', 'drivers');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS push_notification_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        body VARCHAR NOT NULL,
        audience broadcast_audience_enum NOT NULL,
        sent_count INT NOT NULL DEFAULT 0,
        created_by_user_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS push_notification_logs CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS broadcast_audience_enum;`);
    await queryRunner.query(`
      ALTER TABLE platform_settings
        DROP COLUMN IF EXISTS platform_name,
        DROP COLUMN IF EXISTS support_phone,
        DROP COLUMN IF EXISTS support_email,
        DROP COLUMN IF EXISTS maintenance_mode;
    `);
  }
}
