import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Foydalanuvchi tili (`uz` | `ru`) — push, SMS va bildirishnoma jurnali shu
 * tilda yoziladi. Mavjud hamma foydalanuvchi `uz` bo'lib qoladi (hozirgi
 * xatti-harakat); ilova keyingi so'rovidayoq `Accept-Language` bo'yicha
 * to'g'rilaydi (`JwtStrategy`).
 */
export class UserLanguage1700000004200 implements MigrationInterface {
  name = 'UserLanguage1700000004200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "language" character varying(2) NOT NULL DEFAULT 'uz'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "language"`);
  }
}
