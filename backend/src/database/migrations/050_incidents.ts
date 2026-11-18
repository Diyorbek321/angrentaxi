import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shikoyat va hodisa — yagona `incidents` (docs/INCIDENT-POLICY.md §3).
 *
 *  · `incidents` — yangi jadval. Buyurtma polimorf (`order_vertical` +
 *    `order_id`), shuning uchun `order_id` ga FK yo'q. Bitta xabarchi bitta
 *    buyurtma bo'yicha bir vaqtda faqat BITTA ochiq foydalanuvchi shikoyati
 *    (qisman unikal indeks) — takror bosish ikkinchi qator yaratmaydi.
 *  · `users.suspended_until` / `suspension_reason` — vaqtincha to'xtatish;
 *    `users.passenger_rating` / `passenger_rating_count` — haydovchilarning
 *    yo'lovchiga bahosi (ilgari saqlanardi, lekin hech qayerda ishlatilmasdi).
 *    Mavjud baholardan bir martalik to'ldiriladi.
 *  · `platform_settings` — 11 sozlama. Kodda raqam qotirilmaydi.
 */
export class Incidents1700000005000 implements MigrationInterface {
  name = 'Incidents1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incidents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reporter_user_id" uuid NULL,
        "reporter_role" varchar(20) NOT NULL,
        "subject_user_id" uuid NULL,
        "subject_role" varchar(20) NULL,
        "order_vertical" varchar(10) NULL,
        "order_id" uuid NULL,
        "category" varchar(30) NOT NULL,
        "description" varchar(1000) NOT NULL,
        "photo_keys" jsonb NOT NULL DEFAULT '[]',
        "status" varchar(20) NOT NULL DEFAULT 'open',
        "source" varchar(20) NOT NULL DEFAULT 'user',
        "rating_id" uuid NULL,
        "assigned_manager_id" uuid NULL,
        "resolution_note" varchar(1000) NULL,
        "resolved_by" uuid NULL,
        "resolved_at" timestamptz NULL,
        "confirmed_against_subject" boolean NOT NULL DEFAULT false,
        "outcomes" jsonb NOT NULL DEFAULT '[]',
        "safety_suspended" boolean NOT NULL DEFAULT false,
        "escalated_to_admin" boolean NOT NULL DEFAULT false,
        "appealed_at" timestamptz NULL,
        "appeal_note" varchar(1000) NULL,
        "appeal_decision" varchar(20) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_incidents" PRIMARY KEY ("id"),
        CONSTRAINT "chk_incidents_status" CHECK ("status" IN ('open', 'investigating', 'resolved', 'rejected')),
        CONSTRAINT "chk_incidents_source" CHECK ("source" IN ('user', 'manager', 'rating_signal', 'low_rating')),
        CONSTRAINT "chk_incidents_vertical" CHECK ("order_vertical" IS NULL OR "order_vertical" IN ('taxi', 'food', 'market')),
        CONSTRAINT "chk_incidents_appeal_decision" CHECK ("appeal_decision" IS NULL OR "appeal_decision" IN ('upheld', 'overturned'))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_incidents_status_created" ON "incidents" ("status", "created_at")`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_incidents_subject_resolved" ON "incidents" ("subject_user_id", "resolved_at")`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_incidents_order" ON "incidents" ("order_vertical", "order_id")`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_incidents_reporter_created" ON "incidents" ("reporter_user_id", "created_at")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_incidents_open_reporter_order"
        ON "incidents" ("reporter_user_id", "order_vertical", "order_id")
        WHERE "source" = 'user' AND "status" IN ('open', 'investigating')
          AND "reporter_user_id" IS NOT NULL AND "order_id" IS NOT NULL
    `);

    await queryRunner.query(`ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "suspended_until" timestamptz NULL,
      ADD COLUMN IF NOT EXISTS "suspension_reason" varchar(300) NULL,
      ADD COLUMN IF NOT EXISTS "passenger_rating" decimal(3,2) NULL,
      ADD COLUMN IF NOT EXISTS "passenger_rating_count" int NOT NULL DEFAULT 0`);
    await queryRunner.query(`
      UPDATE "users" u SET "passenger_rating" = r.avg, "passenger_rating_count" = r.cnt
        FROM (SELECT to_user_id, ROUND(AVG(score)::numeric, 2) AS avg, COUNT(*)::int AS cnt
                FROM ratings WHERE from_role = 'driver' GROUP BY to_user_id) r
       WHERE u.id = r.to_user_id
    `);

    await queryRunner.query(`ALTER TABLE "platform_settings"
      ADD COLUMN IF NOT EXISTS "incident_report_window_days" int NOT NULL DEFAULT 7,
      ADD COLUMN IF NOT EXISTS "incident_appeal_window_days" int NOT NULL DEFAULT 7,
      ADD COLUMN IF NOT EXISTS "suspension_days" int NOT NULL DEFAULT 3,
      ADD COLUMN IF NOT EXISTS "strike_window_days" int NOT NULL DEFAULT 90,
      ADD COLUMN IF NOT EXISTS "strike_warning_at" int NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "strike_suspension_at" int NOT NULL DEFAULT 3,
      ADD COLUMN IF NOT EXISTS "strike_block_at" int NOT NULL DEFAULT 5,
      ADD COLUMN IF NOT EXISTS "rating_signal_window" int NOT NULL DEFAULT 20,
      ADD COLUMN IF NOT EXISTS "rating_signal_threshold" decimal(3,2) NOT NULL DEFAULT 4.3,
      ADD COLUMN IF NOT EXISTS "rating_signal_cooldown_days" int NOT NULL DEFAULT 30,
      ADD COLUMN IF NOT EXISTS "low_rating_incident_max_score" int NOT NULL DEFAULT 2`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_settings"
      DROP COLUMN IF EXISTS "incident_report_window_days",
      DROP COLUMN IF EXISTS "incident_appeal_window_days",
      DROP COLUMN IF EXISTS "suspension_days",
      DROP COLUMN IF EXISTS "strike_window_days",
      DROP COLUMN IF EXISTS "strike_warning_at",
      DROP COLUMN IF EXISTS "strike_suspension_at",
      DROP COLUMN IF EXISTS "strike_block_at",
      DROP COLUMN IF EXISTS "rating_signal_window",
      DROP COLUMN IF EXISTS "rating_signal_threshold",
      DROP COLUMN IF EXISTS "rating_signal_cooldown_days",
      DROP COLUMN IF EXISTS "low_rating_incident_max_score"`);
    await queryRunner.query(`ALTER TABLE "users"
      DROP COLUMN IF EXISTS "suspended_until",
      DROP COLUMN IF EXISTS "suspension_reason",
      DROP COLUMN IF EXISTS "passenger_rating",
      DROP COLUMN IF EXISTS "passenger_rating_count"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "incidents"`);
  }
}
