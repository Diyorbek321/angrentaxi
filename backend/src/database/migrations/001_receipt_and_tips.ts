import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chek va chaqim uchun `orders` ustunlari.
 *
 * `IF NOT EXISTS` ATAYLAB ishlatiladi: `app.module.ts` da dev muhitida
 * `synchronize` yoqiq, ya'ni ustunlar entity'dan avtomatik yaratilgan bo'lishi
 * mumkin. Migratsiya o'sha holatga ham tushishi va yiqilmasligi kerak —
 * `000_baseline.ts` ning butun mantig'i shu haqida.
 *
 * `migrationsTransactionMode` berilmagani uchun TypeORM default `'all'` da
 * ishlaydi: barcha kutayotgan migratsiyalar BITTA tranzaksiyada bajariladi.
 * Shuning uchun bu yerdagi `UPDATE` ham xuddi shu tranzaksiya ichida —
 * yarim bajarilgan holat qolmaydi.
 */
export class ReceiptAndTips1700000000100 implements MigrationInterface {
  name = 'ReceiptAndTips1700000000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Chek ---
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "fare_breakdown" jsonb,
        ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "surge_multiplier" numeric(4,2) NOT NULL DEFAULT 1.00
    `);

    // --- Chaqim ---
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "tip_amount" numeric(10,2),
        ADD COLUMN IF NOT EXISTS "tip_payment_method" "public"."orders_payment_method_enum",
        ADD COLUMN IF NOT EXISTS "tip_paid_at" TIMESTAMP
    `);

    // Eski tugagan safarlarga chek sanasini `trips.end_time` dan tiklaymiz.
    // Bularda `fare_breakdown` NULL qoladi — chek ekrani buni "tarkib mavjud
    // emas" deb ko'rsatadi. Soxta tarkib O'YLAB TOPILMAYDI: o'sha safar qaysi
    // tarif bilan hisoblanganini endi bilib bo'lmaydi.
    await queryRunner.query(`
      UPDATE "orders" o
         SET "completed_at" = t."end_time"
        FROM "trips" t
       WHERE t."order_id" = o."id"
         AND o."status" = 'completed'
         AND o."completed_at" IS NULL
         AND t."end_time" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "tip_paid_at",
        DROP COLUMN IF EXISTS "tip_payment_method",
        DROP COLUMN IF EXISTS "tip_amount",
        DROP COLUMN IF EXISTS "surge_multiplier",
        DROP COLUMN IF EXISTS "completed_at",
        DROP COLUMN IF EXISTS "fare_breakdown"
    `);
  }
}
