import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Haydovchi imkoniyatlari: `vehicle_type` va `service_types`.
 *
 * NEGA kerak: matching'da buyurtma turi bo'yicha filtr yo'q edi — yuk
 * buyurtmasi 3 km ichidagi BARCHA onlayn haydovchiga, furgon egasiga ham,
 * oddiy yengil avtomobilga ham bir xil tarqalardi. Filtr ishlashi uchun
 * haydovchi tomonida "men nima qila olaman" degan ma'lumot bo'lishi shart.
 *
 * ⚠️ ENG MUHIM QISM — mavjud qatorlar. Bu ustunlar bo'sh qolsa, migratsiya
 * tushgan lahzada butun mavjud park matching'dan chiqib ketardi va BIRORTA
 * taksi buyurtmasi taqsimlanmasdi. Shuning uchun `service_types` NOT NULL va
 * DEFAULT '["taxi"]': `ADD COLUMN` mavjud har bir qatorga o'sha qiymatni
 * yozadi. Keyingi UPDATE — `synchronize` ustunni DEFAULT'siz yaratib
 * qo'ygan dev bazalari uchun zaxira (003 dagi `IF NOT EXISTS` bilan bir xil
 * mulohaza). Kod tomonida ham xuddi shu qoida bor
 * (`resolveDriverServiceTypes`) — ikkalasi mustaqil ravishda kerak.
 *
 * `vehicle_type` esa ATAYLAB NULL bo'lib qoladi: tariflar tomonidagi
 * konventsiya bo'yicha NULL = yengil avtomobil (taksi), va migratsiyagacha
 * ro'yxatdan o'tgan haydovchilarning hammasi aynan taksi haydovchisi.
 * Ularga soxta yuk turi yozish ularni yuk buyurtmalariga chiqarib yuborardi.
 */
export class DriverCapabilities1700000000400 implements MigrationInterface {
  name = 'DriverCapabilities1700000000400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "drivers"
        ADD COLUMN IF NOT EXISTS "vehicle_type" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "drivers"
        ADD COLUMN IF NOT EXISTS "service_types" jsonb NOT NULL DEFAULT '["taxi"]'
    `);

    // Mavjud haydovchilar: bo'sh yoki NULL ro'yxatni ['taxi'] ga to'ldirish.
    await queryRunner.query(`
      UPDATE "drivers"
         SET "service_types" = '["taxi"]'::jsonb
       WHERE "service_types" IS NULL
          OR jsonb_typeof("service_types") <> 'array'
          OR jsonb_array_length("service_types") = 0
    `);

    // Yuqoridagi `ADD COLUMN IF NOT EXISTS` — ustun `synchronize` tomonidan
    // ALLAQACHON yaratilgan bazada BUTUNLAY o'tkazib yuboriladi, ya'ni
    // NOT NULL ham, DEFAULT ham qo'llanmay qoladi. Shuning uchun ikkalasi
    // shu yerda alohida o'rnatiladi: migratsiya qaysi yo'ldan kelganidan
    // qat'i nazar, oxirgi holat bir xil bo'lishi kerak.
    await queryRunner.query(`
      ALTER TABLE "drivers" ALTER COLUMN "service_types" SET DEFAULT '["taxi"]'
    `);
    await queryRunner.query(`
      ALTER TABLE "drivers" ALTER COLUMN "service_types" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "drivers" DROP COLUMN IF EXISTS "service_types"`);
    await queryRunner.query(`ALTER TABLE "drivers" DROP COLUMN IF EXISTS "vehicle_type"`);
  }
}
