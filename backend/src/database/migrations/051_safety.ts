import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Xavfsizlik (docs/INCIDENT-POLICY.md §4).
 *
 *  · `sos_alerts.resolved_by` / `resolution_note` — SOS yopishda izoh
 *    majburiy, kim yopgani yoziladi (audit `sos.resolve` bilan bir
 *    tranzaksiyada).
 *  · `trip_share_links` — yo'lovchining "safarni ulashish" havolasi. Token
 *    o'zi saqlanMAYDI, faqat SHA-256 xeshi: baza sizib chiqsa ham havolani
 *    tiklab bo'lmaydi. Muddat — safar tugagach `tripShareGraceMinutes`.
 *  · `order_call_logs` — "ilova orqali qo'ng'iroq" so'rovlari jurnali
 *    (telefon raqami yashirilgan, server faol buyurtmada beradi).
 *  · `platform_settings.trip_share_grace_minutes` — kodda raqam qotirilmaydi.
 */
export class Safety1700000005100 implements MigrationInterface {
  name = 'Safety1700000005100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sos_alerts"
      ADD COLUMN IF NOT EXISTS "resolved_by" uuid NULL,
      ADD COLUMN IF NOT EXISTS "resolution_note" varchar(500) NULL`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trip_share_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "revoked_at" timestamptz NULL,
        CONSTRAINT "PK_trip_share_links" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trip_share_links_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_trip_share_links_token_hash" ON "trip_share_links" ("token_hash")`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_trip_share_links_order" ON "trip_share_links" ("order_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_call_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "caller_user_id" uuid NOT NULL,
        "caller_role" varchar(20) NOT NULL,
        "callee_user_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_call_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_call_logs_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_order_call_logs_order_created" ON "order_call_logs" ("order_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_order_call_logs_created" ON "order_call_logs" ("created_at")`,
    );

    await queryRunner.query(`ALTER TABLE "platform_settings"
      ADD COLUMN IF NOT EXISTS "trip_share_grace_minutes" int NOT NULL DEFAULT 30`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN IF EXISTS "trip_share_grace_minutes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_call_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trip_share_links"`);
    await queryRunner.query(`ALTER TABLE "sos_alerts"
      DROP COLUMN IF EXISTS "resolved_by",
      DROP COLUMN IF EXISTS "resolution_note"`);
  }
}
