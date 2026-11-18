import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O'zini o'zi zakaz qilishni aniqlash (biznes qarori, 2026-10-06).
 *
 *  · `passenger_device_id` / `driver_device_id` — buyurtma berilgan va qabul
 *    qilingan telefonning ANDROID_ID si (`X-Device-Id` sarlavhasi). Bitta
 *    telefon = eng kuchli belgi.
 *  · `accept_distance_m` — haydovchi qabul qilgan paytda olish nuqtasigacha.
 *  · `fraud_signals` — topilgan belgilar (`fraud-rules.ts`).
 *  · `fraud_review` — NULL (toza) | pending | approved | rejected. Pending va
 *    rejected safarlar bonus/referal hisobiga KIRMAYDI; to'lov o'zgarmaydi.
 *
 * Hammasi NULL bo'la oladi: eski safarlar tekshirilmagan, ya'ni toza.
 */
export class OrderFraudReview1700000001800 implements MigrationInterface {
  name = 'OrderFraudReview1700000001800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "passenger_device_id" varchar(64),
        ADD COLUMN IF NOT EXISTS "driver_device_id" varchar(64),
        ADD COLUMN IF NOT EXISTS "accept_distance_m" int,
        ADD COLUMN IF NOT EXISTS "fraud_signals" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "fraud_review" varchar(20),
        ADD COLUMN IF NOT EXISTS "fraud_reviewed_by" uuid,
        ADD COLUMN IF NOT EXISTS "fraud_reviewed_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "fraud_note" varchar(300)
    `);
    // Menejer navbati faqat pending qatorlarni o'qiydi — qisman indeks.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_orders_fraud_review_pending"
        ON "orders" ("completed_at") WHERE "fraud_review" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_fraud_review_pending"`);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "fraud_note",
        DROP COLUMN IF EXISTS "fraud_reviewed_at",
        DROP COLUMN IF EXISTS "fraud_reviewed_by",
        DROP COLUMN IF EXISTS "fraud_review",
        DROP COLUMN IF EXISTS "fraud_signals",
        DROP COLUMN IF EXISTS "accept_distance_m",
        DROP COLUMN IF EXISTS "driver_device_id",
        DROP COLUMN IF EXISTS "passenger_device_id"
    `);
  }
}
