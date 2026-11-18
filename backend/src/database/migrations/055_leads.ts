import { MigrationInterface, QueryRunner } from 'typeorm';

/** Korporativ saytdan arizalar (haydovchi / kuryer / hamkor). */
export class Leads1700000005500 implements MigrationInterface {
  name = 'Leads1700000005500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "leads" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" varchar(20) NOT NULL CHECK ("type" IN ('driver','courier','partner')),
        "name" varchar(80) NOT NULL,
        "phone" varchar(16) NOT NULL,
        "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "lang" varchar(2) NOT NULL DEFAULT 'uz',
        "status" varchar(20) NOT NULL DEFAULT 'new'
          CHECK ("status" IN ('new','contacted','accepted','rejected')),
        "note" text NULL,
        "consent_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_leads_status_created" ON "leads" ("status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_leads_phone_type" ON "leads" ("phone", "type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "leads"`);
  }
}
