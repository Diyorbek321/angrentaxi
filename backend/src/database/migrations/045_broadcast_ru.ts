import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ommaviy push (admin → Push xabarnomalar) uz/ru: ruscha sarlavha va matn
 * ixtiyoriy. NULL — ruscha foydalanuvchilar o'zbekcha matnni oladi.
 */
export class BroadcastRu1700000004500 implements MigrationInterface {
  name = 'BroadcastRu1700000004500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "push_notification_logs" ADD COLUMN IF NOT EXISTS "title_ru" character varying`);
    await queryRunner.query(`ALTER TABLE "push_notification_logs" ADD COLUMN IF NOT EXISTS "body_ru" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "push_notification_logs" DROP COLUMN IF EXISTS "body_ru"`);
    await queryRunner.query(`ALTER TABLE "push_notification_logs" DROP COLUMN IF EXISTS "title_ru"`);
  }
}
