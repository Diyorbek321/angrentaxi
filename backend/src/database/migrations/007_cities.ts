import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ko'p shaharlilik: `cities` jadvali va uni buyurtma/haydovchi/tarif bilan
 * bog'lovchi ustunlar.
 *
 * ⚠️ ENG MUHIM QISM — `cities` BO'SH yaratiladi va birorta mavjud qatorga
 * ham tegilmaydi. Ikkala himoya aynan shu yerda tug'iladi:
 *
 *   (a) Faol shahar yo'q ekan, `OrdersCreationService` shahar tekshiruvini
 *       UMUMAN qo'llamaydi. Ya'ni bu migratsiya tushgan lahzada birorta
 *       buyurtma ham rad etilmaydi — qamrov faqat kimdir Angrenni qo'shgan
 *       kundan boshlab kuchga kiradi.
 *
 *   (b) `tariffs.city_id` NULL bo'lib qoladi = "barcha shaharlarga tegishli".
 *       Mavjud tariflar shu sababli bironta ham yo'qolmaydi; `findAll`
 *       cityId bilan chaqirilganda ham ular ro'yxatda qoladi.
 *
 * Agar bu yerga `INSERT INTO cities ... 'Angren'` yozilsa, ikkala himoya ham
 * bir vaqtda ishdan chiqardi: deploy lahzasida qamrov yoqilib, Angren
 * doirasidan tashqaridagi har bir buyurtma to'satdan 400 qaytara boshlardi.
 * Angren shuning uchun SEED'da (`database/seeds/seed.ts`) va menejer
 * paneli orqali qo'shiladi.
 *
 * ⚠️ NEGA `ON DELETE SET NULL`: shahar qatori o'chirilsa, unga bog'langan
 * buyurtmalar tarixi ham kaskad bilan o'chib ketmasligi kerak — safar
 * bo'lgan, hisobot esa raqamni yo'qotmasligi lozim. Shahar o'chirilgan
 * buyurtma "shahri noma'lum buyurtma" ga aylanadi, xolos. Amalda shaharni
 * o'chirish o'rniga `is_active = false` qilinadi.
 *
 * `IF NOT EXISTS` — dev muhitida `synchronize` yoqiq bo'lgani uchun ustunlar
 * entity'dan avtomatik yaratilgan bo'lishi mumkin (004-006 dagi bilan bir
 * xil mulohaza).
 */
export class Cities1700000000700 implements MigrationInterface {
  name = 'Cities1700000000700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "center_lat" numeric(10,7) NOT NULL,
        "center_lng" numeric(10,7) NOT NULL,
        "radius_km" numeric(6,2) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cities" PRIMARY KEY ("id")
      )
    `);

    // Keshni to'ldiruvchi yagona so'rov: faol shaharlar, ko'rsatish tartibida.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cities_is_active_sort_order"
        ON "cities" ("is_active", "sort_order")
    `);

    for (const table of ['orders', 'drivers', 'tariffs']) {
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "city_id" uuid
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "FK_${table}_city"
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD CONSTRAINT "FK_${table}_city"
          FOREIGN KEY ("city_id") REFERENCES "cities"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION
      `);
    }

    // Hisobotning shahar kesimi: `WHERE city_id = ... AND created_at BETWEEN`.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_orders_city_id_created_at"
        ON "orders" ("city_id", "created_at")
    `);

    // `findAll(serviceType, cityId)` — `(city_id IS NULL OR city_id = :id)`
    // shartini faol tariflar ichidan tanlaydi.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tariffs_city_id_is_active"
        ON "tariffs" ("city_id", "is_active")
    `);

    // Menejer paneli haydovchilarni shahar bo'yicha filtrlashi uchun.
    // ⚠️ Matching bu ustunni ISHLATMAYDI — izohni `Driver.cityId` da ko'ring.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_drivers_city_id"
        ON "drivers" ("city_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['orders', 'drivers', 'tariffs']) {
      await queryRunner.query(`
        ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "FK_${table}_city"
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}" DROP COLUMN IF EXISTS "city_id"
      `);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "cities"`);
  }
}
