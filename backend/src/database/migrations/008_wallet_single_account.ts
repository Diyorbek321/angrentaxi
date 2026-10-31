import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Haydovchi uchun BITTA pul hisobi.
 *
 * Ikki ish qiladi:
 *
 *   1. `withdrawal_requests.payout_reference` ustunini qo'shadi — to'lov
 *      provayderi bergan o'tkazma raqami uchun (`payout.interface.ts`).
 *
 *   2. Naqd safarlardan daftarga xato tushgan CREDIT qatorlarini
 *      TESKARI QATOR bilan yopadi.
 *
 * ⚠️ IKKINCHISI NIMA UCHUN KERAK. Safar yakunlanganda haydovchiga ikkita
 * daftar qatori yozilardi: to'liq summa CREDIT va komissiya DEBIT. Naqd
 * safarda `chargeStatus` COMPLETED bo'lgani uchun ikkalasi ham darhol
 * "sarflanadigan" holatga tushardi — ya'ni sof daromad haydovchining
 * YECHIB OLINADIGAN hamyoniga qo'shilardi. Pul esa allaqachon uning
 * cho'ntagida edi: yo'lovchi naqd bergan, platforma unga umuman
 * tegmagan.
 *
 * Natijada faqat naqd bilan ishlaydigan haydovchi bir pulni ikki marta
 * olishi mumkin edi — bir marta yo'lovchidan, ikkinchi marta yechish
 * so'rovi orqali platformadan. Yechish aynan shu daftarni tekshiradi.
 *
 * ⚠️ NEGA O'CHIRILMAYDI, BALKI TESKARI QATOR YOZILADI. Pul daftaridan
 * qator o'chirish o'tmishdagi qoldiqni tushuntirib bo'lmaydigan qilib
 * qo'yadi: keyin kimdir "nega bu haydovchining balansi o'zgardi?" deb
 * so'rasa, javob beradigan hech narsa qolmaydi. Buxgalteriya amaliyoti
 * ham shu — xato yozuv o'chirilmaydi, uni yopadigan yozuv qo'yiladi.
 *
 * ⚠️ DAROMAD KO'RSATKICHIGA TA'SIR QILMAYDI. `OrdersEarningsService`
 * gross summani `orders.final_price` dan, komissiyani esa `external_id =
 * 'commission'` qatoridan oladi — bu qatorlarga umuman qaramaydi. Ya'ni
 * haydovchi o'z daromadini avvalgidek to'liq ko'radi; o'zgaradigan narsa
 * faqat YECHIB OLINADIGAN qoldiq.
 */
export class WalletSingleAccount1700000000800 implements MigrationInterface {
  name = 'WalletSingleAccount1700000000800';

  /**
   * Xato CREDIT qatorlarini ajratib oluvchi shart.
   *
   * Har bir bo'lak ATAYLAB:
   *   type/payment_method — faqat naqd safarning haydovchi kredit oyog'i;
   *   external_id IS NULL — chaqim (`tip`), referal bonusi, food/market va
   *     yechish qatorlarining hammasida belgi bor, ular tegilmaydi;
   *   bonus_rule_id IS NULL — haydovchi bonuslari ham CREDIT, lekin ular
   *     haqiqiy pul va saqlanishi shart;
   *   order_id/driver_id — admin qo'lda qo'shgan mablag'da `order_id` yo'q,
   *     yo'lovchi qatori esa DEBIT; ikkalasi ham chetda qoladi.
   */
  private static readonly ERRONEOUS_CASH_CREDITS = `
    SELECT t.id, t.user_id, t.order_id, t.amount
      FROM transactions t
      JOIN orders o ON o.id = t.order_id
     WHERE t.type = 'credit'
       AND t.payment_method = 'cash'
       AND t.external_id IS NULL
       AND t.bonus_rule_id IS NULL
       AND t.user_id = o.driver_id
  `;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "withdrawal_requests"
        ADD COLUMN IF NOT EXISTS "payout_reference" character varying
    `);

    // Qancha qator ta'sirlanishi — migratsiya jurnalida qoladi, chunki bu
    // pulga tegadigan yagona qadam va keyin "nima bo'ldi?" degan savolga
    // javob kerak bo'ladi.
    const affected: Array<{ user_id: string; cnt: string; total: string }> =
      await queryRunner.query(`
        SELECT user_id, COUNT(*)::text AS cnt, SUM(amount)::text AS total
          FROM (${WalletSingleAccount1700000000800.ERRONEOUS_CASH_CREDITS}) AS e
         GROUP BY user_id
      `);

    for (const row of affected) {
      console.log(
        `[008] Haydovchi ${row.user_id}: ${row.cnt} ta naqd kredit qatori, ` +
          `jami ${row.total} — teskari qator yoziladi`,
      );
    }

    // ⚠️ IDEMPOTENT: har teskari qator o'zi yopayotgan qatorning id'si
    // bilan belgilanadi va `NOT EXISTS` takroriy yozishni to'sadi.
    // Migratsiya ikki marta ishlasa (qayta tiklangan baza, qo'lda
    // qayta ishga tushirish) qoldiq ikki barobar kamayib ketmasligi kerak.
    await queryRunner.query(`
      INSERT INTO transactions
        (user_id, order_id, amount, type, payment_method, status, external_id)
      SELECT e.user_id,
             e.order_id,
             e.amount,
             'debit',
             'cash',
             'completed',
             'cash_credit_reversal_' || e.id
        FROM (${WalletSingleAccount1700000000800.ERRONEOUS_CASH_CREDITS}) AS e
       WHERE NOT EXISTS (
             SELECT 1 FROM transactions r
              WHERE r.external_id = 'cash_credit_reversal_' || e.id
       )
    `);
  }

  /**
   * Teskari qatorlarni olib tashlaydi — ya'ni xato qoldiq QAYTADI.
   *
   * `payout_reference` ustuni ATAYLAB tushirilmaydi: unda haqiqiy to'lov
   * raqamlari bo'lishi mumkin va ularni yo'qotish nizoni hal qilishning
   * yagona ipini uzardi. Ustunni saqlab qolish hech narsani buzmaydi.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM transactions
       WHERE external_id LIKE 'cash_credit_reversal_%'
    `);
  }
}
