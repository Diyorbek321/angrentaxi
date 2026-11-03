import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dalillarni saqlash muddati (docs/INCIDENT-POLICY.md §6).
 *
 *  · `platform_settings.evidence_retention_days` (180) — GPS izi, safar
 *    chati, SOS, qo'ng'iroq jurnali va hodisa fotolari shundan keyin
 *    o'chiriladi (`EvidenceRetentionService`, kunlik cron). Ochiq hodisaga
 *    bog'langanlari — hodisa yopilgandan keyin shuncha kun.
 *  · O'chirish indekslar bo'yicha bo'laklab: `trip_messages.created_at`,
 *    `sos_alerts.created_at` va `incidents` foto qidiruvi uchun indekslar.
 */
export class EvidenceRetention1700000005300 implements MigrationInterface {
  name = 'EvidenceRetention1700000005300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings"
      ADD COLUMN IF NOT EXISTS "evidence_retention_days" int NOT NULL DEFAULT 180`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_trip_track_points_recorded_at" ON "trip_track_points" ("recorded_at")`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_trip_messages_created_at" ON "trip_messages" ("created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sos_alerts_created_at" ON "sos_alerts" ("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sos_alerts_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trip_messages_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trip_track_points_recorded_at"`);
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN IF EXISTS "evidence_retention_days"`);
  }
}
