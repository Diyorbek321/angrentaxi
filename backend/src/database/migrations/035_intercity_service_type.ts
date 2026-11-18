import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shaharlararo qatnov — 2-qadam (a): `orders.service_type` ga `intercity`.
 *
 * ⚠️ NEGA ALOHIDA MIGRATSIYA. Postgres `ALTER TYPE ... ADD VALUE` ni
 * tranzaksiya ichida bajaradi (PG 12+), lekin yangi qiymatni o'sha
 * tranzaksiya COMMIT bo'lmaguncha ISHLATIB bo'lmaydi. TypeORM migratsiyalarni
 * standart holda bitta tranzaksiyada yurgizadi (`migrationsTransactionMode`
 * berilmagan → `'all'`), shuning uchun bu yerda ham, keyingi migratsiyalarda
 * ham `'intercity'` qiymati `orders` qatoriga YOZILMAYDI — faqat qo'shiladi.
 * 014 (posilka) xuddi shu naqsh.
 *
 * "Shaharlararo" tarifi ham shu yerda: `orders.tariff_id` NOT NULL, ya'ni
 * band qilish buyurtmasi biror tarifga bog'lanishi shart. Tarif narxlari
 * ISHLATILMAYDI — narx yo'nalishdan (`intercity_routes`) olinadi va
 * buyurtmaga qat'iy narx bo'lib yoziladi. `tariffs.service_type` — oddiy
 * varchar (enum emas), shuning uchun yuqoridagi cheklov unga tegmaydi.
 * Bunday tarif allaqachon bo'lsa (admin qo'lda yaratgan) — tegilmaydi.
 */
export class IntercityServiceType1700000003500 implements MigrationInterface {
  name = 'IntercityServiceType1700000003500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."orders_service_type_enum" ADD VALUE IF NOT EXISTS 'intercity'`,
    );
    await queryRunner.query(`
      INSERT INTO "tariffs" ("name", "service_type", "base_price", "price_per_km", "price_per_min", "min_price", "is_active")
      SELECT 'Shaharlararo', 'intercity', 0, 0, 0, 0, true
      WHERE NOT EXISTS (SELECT 1 FROM "tariffs" WHERE "service_type" = 'intercity')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Enum qiymatini Postgres'da olib tashlab bo'lmaydi; tarif faqat unga
    // buyurtma bog'lanmagan bo'lsa olinadi.
    await queryRunner.query(`
      DELETE FROM "tariffs" t WHERE t."service_type" = 'intercity'
        AND NOT EXISTS (SELECT 1 FROM "orders" o WHERE o."tariff_id" = t."id")
    `);
  }
}
