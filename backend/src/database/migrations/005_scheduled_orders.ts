import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rejalashtirilgan safar: `orders.scheduled_at` + `scheduled` holati.
 *
 * `scheduled_at IS NULL` — odatdagi "hozir" buyurtmasi, mavjud xatti-harakat
 * 1:1 saqlanadi. Qiymat bo'lsa, buyurtma `scheduled` holatida kutib turadi va
 * `ScheduledOrdersService` cron'i vaqti kelganda uni `created` ga o'tkazib
 * haydovchi qidiruvini boshlaydi.
 *
 * ⚠️ NEGA BU MIGRATSIYA `'scheduled'` QIYMATINI HECH QAYERDA ISHLATMAYDI:
 * `app.module.ts` da `migrationsRun: true` va `migrationsTransactionMode`
 * berilmagan → TypeORM default `'all'`, ya'ni barcha kutayotgan migratsiyalar
 * BITTA tranzaksiyada bajariladi. Postgres 12+ da `ALTER TYPE ... ADD VALUE`
 * tranzaksiya ichida ishlaydi, LEKIN yangi qiymatni o'sha tranzaksiya ichida
 * ISHLATIB bo'lmaydi — `DEFAULT`, `UPDATE`, `CHECK` yoki `WHERE` ichida
 * uchrasa migratsiya yiqiladi. Shuning uchun bu yerda faqat qiymat
 * QO'SHILADI; unga tayanadigan har qanday ma'lumot ko'chirish keyingi
 * deploy'da alohida migratsiya bo'lishi shart.
 *
 * ⚠️ `transaction = false` bilan tranzaksiyadan CHIQIB BO'LMAYDI: `'all'`
 * rejimida TypeORM `ForbiddenTransactionModeOverrideError` tashlab butun
 * migratsiya to'plamini to'xtatadi (MigrationExecutor.js:179-190).
 *
 * `IF NOT EXISTS` — dev muhitida `synchronize` yoqiq bo'lgani uchun ustun va
 * indeks entity'dan avtomatik yaratilgan bo'lishi mumkin (001/003 dagi bilan
 * bir xil mulohaza).
 */
export class ScheduledOrders1700000000500 implements MigrationInterface {
  name = 'ScheduledOrders1700000000500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `BEFORE 'created'` — enum qiymatlari tartibi buyurtmaning tabiiy
    // hayot yo'liga mos bo'lsin: reja → yaratildi → qidirilmoqda → ...
    // Bu `ORDER BY status` ishlatadigan har qanday hisobotni o'qilishi
    // mumkin holda saqlaydi.
    await queryRunner.query(`
      ALTER TYPE "public"."orders_status_enum"
        ADD VALUE IF NOT EXISTS 'scheduled' BEFORE 'created'
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMPTZ
    `);

    // Cron har daqiqada shu indeks bo'yicha so'raydi — entity'dagi
    // `@Index('idx_orders_status_scheduled_at', ...)` bilan bir xil nom,
    // shuning uchun `synchronize` ishlagan baza bilan migratsiya ishlagan
    // baza bir xil bo'ladi.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_orders_status_scheduled_at"
        ON "orders" ("status", "scheduled_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_status_scheduled_at"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "scheduled_at"`);
    // `'scheduled'` enum qiymati ATAYLAB o'chirilmaydi: Postgres enum
    // qiymatini olib tashlashning to'g'ridan-to'g'ri usuli yo'q — butun
    // tipni qayta yaratish va `orders.status` ustunini qayta yozish kerak
    // bo'lardi. Ortiqcha qiymat esa hech narsani buzmaydi.
  }
}
