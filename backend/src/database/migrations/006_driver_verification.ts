import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Haydovchining davriy tekshiruvi: qoidalar jadvali + yuborilgan materiallar.
 *
 * NEGA kerak: `driver_documents` da MUDDAT tushunchasi umuman yo'q edi — bir
 * marta yuklangan hujjat abadiy amal qilardi va avtomobil holatini davriy
 * tekshirishning imkoni yo'q edi.
 *
 * ⚠️ ENG MUHIM QISM — `driver_verification_requirements` BO'SH yaratiladi.
 * Bu ataylab: haqiqiy talablar ro'yxati keyin beriladi, va tizim "qoida yo'q"
 * ni "hammasi taqiqlangan" deb o'qimasligi kerak. Kod tomonida ham xuddi shu
 * himoya bor (`DriverVerificationService#getSummaryForDriver`), ya'ni bu
 * migratsiya tushgan lahzada BIRORTA haydovchi ham oflayn bo'lib qolmaydi.
 *
 * ⚠️ NEGA PG enum EMAS, `character varying`: `app.module.ts` da
 * `migrationsRun: true` va tranzaksiya rejimi standart `'all'` — barcha
 * migratsiyalar bitta tranzaksiyada ketadi. Enum bilan ishlash keyinchalik
 * yangi qiymat qo'shishni migratsiya muammosiga aylantirardi (005 dagi
 * batafsil izohga qarang). Bu yerdagi `kind`, `service_type`, `vehicle_type`,
 * `review_status` — hammasi kengayishi kutilayotgan qiymatlar, shuning uchun
 * satr. `drivers.vehicle_type` va `tariffs.service_type` allaqachon shunday.
 *
 * `IF NOT EXISTS` — dev muhitida `synchronize` yoqiq bo'lgani uchun jadvallar
 * entity'dan avtomatik yaratilgan bo'lishi mumkin (004/005 dagi bilan bir xil
 * mulohaza).
 */
export class DriverVerification1700000000600 implements MigrationInterface {
  name = 'DriverVerification1700000000600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "driver_verification_requirements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(100) NOT NULL,
        "label" character varying(200) NOT NULL,
        "hint" character varying(300),
        "kind" character varying(30) NOT NULL DEFAULT 'document',
        "service_type" character varying(30),
        "vehicle_type" character varying(30),
        "cadence_days" integer NOT NULL DEFAULT 0,
        "grace_days" integer NOT NULL DEFAULT 0,
        "is_required" boolean NOT NULL DEFAULT true,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_driver_verification_requirements_code" UNIQUE ("code"),
        CONSTRAINT "PK_driver_verification_requirements" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_driver_verification_requirements_active_sort"
        ON "driver_verification_requirements" ("is_active", "sort_order")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "driver_verification_submissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "driver_id" uuid NOT NULL,
        "code" character varying(100) NOT NULL,
        "file_url" character varying NOT NULL,
        "review_status" character varying(20) NOT NULL DEFAULT 'pending',
        "rejection_reason" character varying(500),
        "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "reviewed_by" uuid,
        "valid_until" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_driver_verification_submissions" PRIMARY KEY ("id")
      )
    `);

    // Bitta haydovchining har bir `code` i bo'yicha eng oxirgi yuborilgani —
    // har `GET /drivers/me/verification` va har `goOnline` da o'qiladi.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_driver_verification_submissions_driver_code"
        ON "driver_verification_submissions" ("driver_id", "code", "submitted_at")
    `);

    // Menejer navbati: ko'rilmaganlar, eng eskisi birinchi.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_driver_verification_submissions_review_status"
        ON "driver_verification_submissions" ("review_status", "submitted_at")
    `);

    // `code` ATAYLAB chet el kaliti EMAS (izohni entity'da ham ko'ring):
    // qoida qatori o'chirilsa yoki qayta yaratilsa, yuborilgan materiallar
    // tarixi kaskad bilan o'chib ketmasligi kerak. `driver_id` esa haqiqiy
    // bog'lanish — haydovchi o'chsa, uning materiallari ham keraksiz.
    await queryRunner.query(`
      ALTER TABLE "driver_verification_submissions"
        DROP CONSTRAINT IF EXISTS "FK_driver_verification_submissions_driver"
    `);
    await queryRunner.query(`
      ALTER TABLE "driver_verification_submissions"
        ADD CONSTRAINT "FK_driver_verification_submissions_driver"
        FOREIGN KEY ("driver_id") REFERENCES "drivers"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "driver_verification_submissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "driver_verification_requirements"`);
  }
}
