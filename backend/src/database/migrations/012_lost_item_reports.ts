import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * YO'QOLGAN BUYUMLAR.
 *
 * Yo'lovchi safardan keyin mashinada nimadir qoldirganini xabar qiladi,
 * haydovchi "topdim / topmadim" deb javob beradi, dispetcher qaytarilishini
 * tashkil qilib yopadi. Bitta safarga bitta OCHIQ xabar (qisman unikal
 * indeks) — yo'lovchi tugmani ikki marta bossa haydovchiga ikki xabar
 * bormasin.
 */
export class LostItemReports1700000001200 implements MigrationInterface {
  name = 'LostItemReports1700000001200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "lost_item_reports_status_enum"
          AS ENUM ('open', 'found', 'not_found', 'returned', 'closed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lost_item_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "passenger_id" uuid NOT NULL,
        "driver_user_id" uuid NOT NULL,
        "description" varchar(500) NOT NULL,
        "status" "lost_item_reports_status_enum" NOT NULL DEFAULT 'open',
        "driver_note" varchar(500),
        "operator_note" varchar(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lost_item_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lost_item_reports_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_lost_item_reports_status_created"
        ON "lost_item_reports" ("status", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_lost_item_reports_driver"
        ON "lost_item_reports" ("driver_user_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_lost_item_reports_one_open_per_order"
        ON "lost_item_reports" ("order_id") WHERE "status" IN ('open', 'found')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lost_item_reports"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "lost_item_reports_status_enum"`);
  }
}
