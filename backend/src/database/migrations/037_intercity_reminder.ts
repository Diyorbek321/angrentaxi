import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shaharlararo — 6-qadam: jo'nashdan 1 soat oldingi eslatma.
 *
 * `reminder_sent_at` eslatmani BIR MARTA yuborish uchun: cron har 5
 * daqiqada ishlaydi va bir nechta instansda ham bo'lishi mumkin. Eslatma
 * shartli UPDATE bilan "egallanadi" (`reminder_sent_at IS NULL`) —
 * ikkinchi tick yoki ikkinchi instans 0 qator ko'radi va qayta yubormaydi.
 */
export class IntercityReminder1700000003700 implements MigrationInterface {
  name = 'IntercityReminder1700000003700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "intercity_trips"
      ADD COLUMN IF NOT EXISTS "reminder_sent_at" timestamptz NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "intercity_trips" DROP COLUMN IF EXISTS "reminder_sent_at"`);
  }
}
