import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * KUTISH HAQI — server tomonda.
 *
 * Uchta ustun qo'shadi:
 *
 *   orders.arrived_at              — haydovchi olish nuqtasiga kelgan lahza.
 *   tariffs.free_wait_minutes      — bepul kutish oynasi (DEFAULT 3).
 *   tariffs.waiting_price_per_minute — keyingi har bir boshlangan daqiqa
 *                                    narxi, so'm (DEFAULT 500).
 *
 * ⚠️ NEGA KERAK EDI. Kutish hisoblagichi faqat haydovchi ilovasida, LOKAL
 * ishlardi: ekran ochilganda boshlanardi va ilova qayta ishga tushsa nolga
 * qaytardi. Yo'lovchi uni umuman ko'rmasdi, backend esa hech qachon
 * eshitmasdi — ya'ni raqamning pulga hech qanday aloqasi yo'q edi. Endi
 * manba bitta: `arrived_at` + tarif sozlamalari.
 *
 * ⚠️ ORQAGA MOSLIK.
 *
 *   `arrived_at` NULLABLE va backfill QILINMAYDI. Migratsiyadan oldin
 *   yakunlangan (va hozir jarayonda bo'lgan) buyurtmalarda haydovchi qachon
 *   kelgani hech qayerda yozilmagan — uni taxmin qilib qo'yish soxta
 *   ma'lumot yaratardi va o'sha safarlardan noto'g'ri pul undirilardi.
 *   `NULL` → kutish 0 → hisob-kitob AVVALGIDEK qoladi.
 *
 *   Tarif ustunlari esa NOT NULL + DEFAULT: mavjud tariflar darhol
 *   ishlaydigan qiymat oladi va admin panelda kutish maydonlari paydo
 *   bo'lishini KUTMAYDI. Aks holda migratsiyadan keyingi har bir safar
 *   `NULL` daqiqa narxi bilan hisoblanib, `NaN` ga aylanardi.
 *
 * ⚠️ QIYMATLAR SHU YERDA MUZLATILGAN. `waiting-charge.ts` dagi
 * `DEFAULT_FREE_WAIT_MINUTES` / `DEFAULT_WAITING_PRICE_PER_MINUTE` bir xil
 * raqamlarni beradi, lekin migratsiya ulardan IMPORT QILMAYDI: migratsiya —
 * o'tmish yozuvi, va kodda konstanta o'zgarganda allaqachon bajarilgan
 * migratsiyaning ma'nosi o'zgarib ketmasligi kerak.
 *
 * ⚠️ `IF NOT EXISTS` — bu kod bazasidagi barcha migratsiyalar kabi: bazani
 * qayta tiklash yoki migratsiyani qo'lda qayta ishga tushirish yiqilmasligi
 * uchun.
 */
export class WaitingCharge1700000000900 implements MigrationInterface {
  name = 'WaitingCharge1700000000900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "arrived_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "tariffs"
        ADD COLUMN IF NOT EXISTS "free_wait_minutes" integer NOT NULL DEFAULT 3
    `);

    await queryRunner.query(`
      ALTER TABLE "tariffs"
        ADD COLUMN IF NOT EXISTS "waiting_price_per_minute" integer NOT NULL DEFAULT 500
    `);

    // Ustun avvalroq (masalan qisman bajarilgan migratsiyada) NULL bilan
    // qo'shilgan bo'lsa — to'ldiriladi. `ADD COLUMN ... DEFAULT` yangi
    // qatorlarni allaqachon to'ldiradi, bu esa faqat o'sha chekka holat uchun.
    await queryRunner.query(`
      UPDATE "tariffs"
         SET "free_wait_minutes" = 3
       WHERE "free_wait_minutes" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "tariffs"
         SET "waiting_price_per_minute" = 500
       WHERE "waiting_price_per_minute" IS NULL
    `);
  }

  /**
   * Ustunlarni olib tashlaydi.
   *
   * ⚠️ `arrived_at` bilan birga undan hisoblangan kutish tarixi ham
   * yo'qoladi. Yakunlangan safarlarning cheki esa buzilmaydi: kutish qatori
   * `orders.fare_breakdown` jsonb ichida MUZLATIB yozilgan va u alohida
   * ustunga bog'liq emas — bu tarkibni saqlashning asosiy sababi ham shu.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tariffs" DROP COLUMN IF EXISTS "waiting_price_per_minute"
    `);
    await queryRunner.query(`
      ALTER TABLE "tariffs" DROP COLUMN IF EXISTS "free_wait_minutes"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "arrived_at"
    `);
  }
}
