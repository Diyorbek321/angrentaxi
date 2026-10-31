import { MigrationInterface, QueryRunner } from 'typeorm';

/** Anonim ilova voronkasi — kunlik hisoblagich (`AppFunnelDaily`). */
export class AppFunnelDaily1700000004300 implements MigrationInterface {
  name = 'AppFunnelDaily1700000004300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_funnel_daily" (
        "day" date NOT NULL,
        "app" character varying(16) NOT NULL,
        "step" character varying(32) NOT NULL,
        "count" int NOT NULL DEFAULT 0,
        CONSTRAINT "PK_app_funnel_daily" PRIMARY KEY ("day", "app", "step")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "app_funnel_daily"`);
  }
}
