import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Haydovchi akkauntining yo'lovchi ilovasidagi push tokeni (bitta raqam bilan
 * ikkala ilovaga kirish, 2026-11-18). Faqat ustun qo'shiladi — qaytarish xavfsiz.
 */
export class PassengerAppFcmToken1700000005700 implements MigrationInterface {
  name = 'PassengerAppFcmToken1700000005700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passenger_app_fcm_token" character varying NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "passenger_app_fcm_token"`);
  }
}
