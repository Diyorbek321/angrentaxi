import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { ledgerBalanceSql } from '../../modules/payments/wallet-balance.util';

/**
 * Hamyon yaxlitligi (pul auditi, 2026-10-16).
 *
 *  · `withdrawal_requests.payout_started_at` — PAID uchun single-flight
 *    da'vosi: provayder faqat bir marta chaqiriladi.
 *  · `uq_transactions_withdrawal_refund` — yechish qaytarimi
 *    (`withdrawal_refund_<id>`) bir marta: ikki parallel REJECT pulni ikki
 *    marta qaytara olmaydi.
 *  · `uq_transactions_referral_bonus` — referal bonusi
 *    (`referral_bonus_{passenger|referrer}_<orderId>`) bir marta.
 *
 * Mavjud takrorlar bo'lsa indeks YARATILMAYDI (030 bilan bir xil qoida:
 * daftar qatori o'chirilmaydi, ilova ko'tariladi) — ogohlantirish logda.
 * Takroriy qatorlar ortiqcha to'langan pul: ularni teskari DEBIT bilan qo'lda
 * tuzatib, migratsiyani qayta yurgizing (`down` + `up`). Tekshiruv so'rovi:
 * `SELECT external_id, count(*) FROM transactions WHERE external_id LIKE 'withdrawal_refund_%' GROUP BY 1 HAVING count(*) > 1`.
 *
 *  · `drivers.balance` keshi YANGI formula bilan qayta hisoblanadi: endi
 *    mijozning buyurtma uchun naqd/karta to'lovi hamyonni kamaytirmaydi
 *    (audit #4). Bu ORQAGA qarab ta'sir qiladi — o'zi ham safar qilgan
 *    haydovchilarning qoldig'i bir martalik oshadi (bu xato tuzatilishi,
 *    yangi pul emas). Kesh tenglashmasa, xato tufayli manfiy bo'lib onlayn
 *    chiqa olmagan haydovchi keyingi pul harakatigacha bloklangan qolardi.
 *    `is_online` o'zgarmaydi — yangi manfiy bo'lganlarni keyingi sync o'chiradi.
 *
 * `IF NOT EXISTS` — dev'da `synchronize` ularni oldinroq yaratgan bo'lishi mumkin.
 */
export class WalletIntegrity1700000003300 implements MigrationInterface {
  name = 'WalletIntegrity1700000003300';

  private readonly logger = new Logger('Migration033');

  private static readonly UNIQUE_LEDGER_TAGS = [
    { index: 'uq_transactions_withdrawal_refund', prefix: 'withdrawal_refund_%' },
    { index: 'uq_transactions_referral_bonus', prefix: 'referral_bonus_%' },
  ] as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "withdrawal_requests" ADD COLUMN IF NOT EXISTS "payout_started_at" TIMESTAMP WITH TIME ZONE`,
    );

    for (const { index, prefix } of WalletIntegrity1700000003300.UNIQUE_LEDGER_TAGS) {
      const duplicates = (await queryRunner.query(
        `SELECT external_id, count(*)::int AS n FROM "transactions"
          WHERE external_id LIKE $1 GROUP BY 1 HAVING count(*) > 1`,
        [prefix],
      )) as Array<{ external_id: string; n: number }>;
      if (duplicates.length > 0) {
        this.logger.warn(
          `${index} NOT created: ${duplicates.length} duplicated ${prefix} ledger tag(s) — ` +
            'reverse the extra rows manually, then create the index (see migration 033 header).',
        );
        continue;
      }
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${index}" ON "transactions" ("external_id") WHERE external_id LIKE '${prefix}'`,
      );
    }

    await queryRunner.query(
      `UPDATE "drivers" d
          SET balance = ledger.balance
         FROM (SELECT user_id, ${ledgerBalanceSql()} AS balance FROM "transactions" GROUP BY user_id) ledger
        WHERE ledger.user_id = d.user_id AND d.balance IS DISTINCT FROM ledger.balance`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_transactions_referral_bonus"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_transactions_withdrawal_refund"`);
    await queryRunner.query(`ALTER TABLE "withdrawal_requests" DROP COLUMN IF EXISTS "payout_started_at"`);
  }
}
