import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Katalog rasmlari (2026-10-10): restoran va do'kon muqovasi, taom va
 * mahsulot fotosi. Faqat saqlash kaliti turadi (`catalog/<uuid>.<ext>`),
 * fayl o'zi obyekt omborida. Hammasi ixtiyoriy — rasmsiz yozuvlar avvalgidek
 * platsholder bilan ko'rinadi.
 */
const TABLES = ['restaurants', 'stores', 'dishes', 'products'] as const;

export class CatalogImages1700000002400 implements MigrationInterface {
  name = 'CatalogImages1700000002400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "image_key" varchar(200)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "image_key"`);
    }
  }
}
