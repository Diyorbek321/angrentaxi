import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Oferta va maxfiylik siyosatiga rozilik — versiya bilan
 * (`legal-acceptance.entity.ts`, docs/INCIDENT-POLICY.md "048 oferta roziligi").
 *
 * Faqat yangi jadval: mavjud jadvallarga tegmaydi, boot'da xavfsiz ishlaydi.
 * Eski foydalanuvchilarda qator yo'q — ular ilovani keyingi ochishda rozilik
 * oynasini ko'radi (haydovchi — onlayn chiqishdan oldin).
 */
export class LegalAcceptances1700000004800 implements MigrationInterface {
  name = 'LegalAcceptances1700000004800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "legal_acceptances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "document" character varying(32) NOT NULL,
        "version" character varying(32) NOT NULL,
        "accepted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ip" character varying(64),
        "user_agent" character varying(256),
        "source" character varying(16),
        CONSTRAINT "PK_legal_acceptances" PRIMARY KEY ("id"),
        CONSTRAINT "fk_legal_acceptances_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_legal_acceptances_user_doc_version"
        ON "legal_acceptances" ("user_id", "document", "version")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_legal_acceptances_doc_version"
        ON "legal_acceptances" ("document", "version")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "legal_acceptances"`);
  }
}
