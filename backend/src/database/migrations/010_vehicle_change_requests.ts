import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MASHINA O'ZGARTIRISH SO'ROVLARI.
 *
 * Tasdiqlangan haydovchi mashinasini almashtirmoqchi bo'lsa, o'zgarish
 * darhol `drivers` ga yozilmaydi: yo'lovchiga "shu raqamli mashinani
 * kuting" deb aytiladigan qiymat aynan o'sha ustundan olinadi. So'rov bu
 * jadvalda kutadi, menejer tasdiqlagandagina `drivers` yangilanadi.
 *
 * ⚠️ `IF NOT EXISTS` — kod bazasidagi barcha migratsiyalar kabi, qayta
 * ishga tushirish yiqilmasligi uchun.
 */
export class VehicleChangeRequests1700000001000 implements MigrationInterface {
  name = 'VehicleChangeRequests1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "vehicle_change_requests_status_enum" AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vehicle_change_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "driver_id" uuid NOT NULL,
        "proposed" jsonb NOT NULL,
        "previous" jsonb NOT NULL,
        "status" "vehicle_change_requests_status_enum" NOT NULL DEFAULT 'pending',
        "review_note" varchar(500),
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vehicle_change_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vehicle_change_requests_driver" FOREIGN KEY ("driver_id")
          REFERENCES "drivers"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_vehicle_change_requests_status_created"
        ON "vehicle_change_requests" ("status", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_vehicle_change_requests_driver"
        ON "vehicle_change_requests" ("driver_id")
    `);

    // Bitta haydovchida bir vaqtda faqat BITTA ochiq so'rov — servis ham
    // tekshiradi, bu esa ikki parallel so'rov poygasiga qarshi kafolat.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_vehicle_change_requests_one_pending"
        ON "vehicle_change_requests" ("driver_id") WHERE "status" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vehicle_change_requests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "vehicle_change_requests_status_enum"`);
  }
}
