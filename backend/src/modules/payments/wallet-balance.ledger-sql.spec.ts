import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Transaction } from '../../database/entities/transaction.entity';
import {
  computeBonusBalance,
  computeWalletBalance,
  computeWalletBalances,
  computeWithdrawableBalance,
  syncDriverBalanceColumn,
} from './wallet-balance.util';

/**
 * Daftar SQL'ining RAQAMLAR bilan isboti — haqiqiy Postgres'da.
 *
 * Mock'langan spec SQL matnini tekshiradi, lekin "5 000 bonus + 20 000 naqd
 * safar = 5 000" ni faqat haqiqiy so'rov isbotlaydi. Har bir test bitta
 * ulanishda TEMP jadvallar yaratadi (`pg_temp` qidiruv yo'lida birinchi —
 * `transactions` haqiqiy jadvalni soyalaydi), ya'ni bazadagi ma'lumotga
 * tegmaydi.
 *
 * Faqat `LEDGER_SQL_SPEC_DATABASE_URL` berilganda ishlaydi (masalan lokal
 * `postgres://angren:…@localhost:5433/angren_taxi`), aks holda o'tkazib
 * yuboriladi — CI'da Postgres bo'lmasa ham suite yashil qoladi.
 */
const url = process.env.LEDGER_SQL_SPEC_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

const PASSENGER = '00000000-0000-0000-0000-00000000000a';
const DRIVER = '00000000-0000-0000-0000-00000000000b';
const ORDER = '00000000-0000-0000-0000-0000000000f1';
const ORDER2 = '00000000-0000-0000-0000-0000000000f2';
const RULE = '00000000-0000-0000-0000-0000000000e1';

interface Row {
  userId: string;
  amount: number;
  type: 'credit' | 'debit';
  method?: 'cash' | 'card' | 'wallet';
  status?: string;
  orderId?: string | null;
  externalId?: string | null;
  bonusRuleId?: string | null;
  at?: string;
}

describeDb('wallet-balance SQL (Postgres)', () => {
  let ds: DataSource;
  let qr: QueryRunner;
  let seq = 0;
  const manager = { query: (sql: string, params?: unknown[]) => qr.query(sql, params) };

  // `computeWalletBalance` QueryBuilder orqali o'qiydi — bu yerda uning
  // SELECT ifodasini to'g'ridan-to'g'ri haqiqiy so'rovga qo'yamiz.
  const repo = {
    createQueryBuilder: () => {
      let expr = '';
      let userId = '';
      const qb = {
        select: (e: string) => ((expr = e), qb),
        where: (_w: string, p: { userId: string }) => ((userId = p.userId), qb),
        getRawOne: async () =>
          ((await qr.query(`SELECT ${expr} AS balance FROM transactions t WHERE t.user_id = $1`, [userId])) as Array<{
            balance: string;
          }>)[0],
      };
      return qb;
    },
  } as unknown as Repository<Transaction>;

  const insert = async (rows: Row[]): Promise<void> => {
    for (const r of rows) {
      seq += 1;
      await qr.query(
        `INSERT INTO transactions (user_id, order_id, amount, type, payment_method, status, external_id, bonus_rule_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          r.userId,
          r.orderId ?? null,
          r.amount,
          r.type,
          r.method ?? 'wallet',
          r.status ?? 'completed',
          r.externalId ?? null,
          r.bonusRuleId ?? null,
          r.at ?? new Date(Date.UTC(2026, 9, 1, 0, 0, seq)).toISOString(),
        ],
      );
    }
  };

  const balance = (userId: string) => computeWalletBalance(repo, userId);

  beforeAll(async () => {
    ds = new DataSource({ type: 'postgres', url, entities: [] });
    await ds.initialize();
    qr = ds.createQueryRunner();
    await qr.connect();
  });

  afterAll(async () => {
    await qr?.release();
    await ds?.destroy();
  });

  beforeEach(async () => {
    seq = 0;
    await qr.query(`DROP TABLE IF EXISTS pg_temp.transactions, pg_temp.wallet_topups, pg_temp.drivers`);
    await qr.query(`CREATE TEMP TABLE transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, order_id uuid,
      amount numeric(10,2) NOT NULL, type text NOT NULL, payment_method text NOT NULL,
      status text NOT NULL, external_id varchar, bonus_rule_id uuid, created_at timestamp NOT NULL)`);
    await qr.query(`CREATE TEMP TABLE wallet_topups (user_id uuid, amount numeric(12,2), status text, paid_at timestamptz)`);
    await qr.query(`CREATE TEMP TABLE drivers (id uuid PRIMARY KEY, user_id uuid, balance numeric(12,2), is_online boolean)`);
  });

  describe("#4 — to'lovchining naqd/karta to'lovi hamyonni kamaytirmaydi", () => {
    it("yo'lovchi: 5 000 referal + 20 000 naqd safar → 5 000", async () => {
      await insert([
        { userId: PASSENGER, amount: 5000, type: 'credit', externalId: `referral_bonus_passenger_${ORDER}`, orderId: ORDER },
        { userId: PASSENGER, amount: 20000, type: 'debit', method: 'cash', orderId: ORDER },
      ]);
      await expect(balance(PASSENGER)).resolves.toBe(5000);
    });

    it('haydovchi: 20 000 naqd safar, 10% komissiya → −2 000 (komissiya HISOBLANADI)', async () => {
      await insert([{ userId: DRIVER, amount: 2000, type: 'debit', method: 'cash', orderId: ORDER, externalId: 'commission' }]);
      await expect(balance(DRIVER)).resolves.toBe(-2000);
    });

    it("soliq va karta qaytarimidagi clawback haydovchidan yechiladi", async () => {
      await insert([
        { userId: DRIVER, amount: 20000, type: 'credit', method: 'card', orderId: ORDER },
        { userId: DRIVER, amount: 2000, type: 'debit', method: 'card', orderId: ORDER, externalId: 'commission' },
        { userId: DRIVER, amount: 200, type: 'debit', method: 'card', orderId: ORDER, externalId: 'tax_withholding' },
        { userId: DRIVER, amount: 17800, type: 'debit', method: 'card', orderId: ORDER, externalId: `refund_clawback_driver_${ORDER}` },
      ]);
      await expect(balance(DRIVER)).resolves.toBe(0);
    });

    it("karta bilan to'langan buyurtma to'lovchi hamyonini kamaytirmaydi", async () => {
      await insert([
        { userId: PASSENGER, amount: 5000, type: 'credit', externalId: 'manual_adjustment_1' },
        // Yakunlash yozgan to'lov (PENDING qoladi) va initiatePayment qatori (COMPLETED).
        { userId: PASSENGER, amount: 30000, type: 'debit', method: 'card', orderId: ORDER, status: 'pending' },
        { userId: PASSENGER, amount: 30000, type: 'debit', method: 'card', orderId: ORDER, externalId: 'payme_abc' },
      ]);
      await expect(balance(PASSENGER)).resolves.toBe(5000);
    });

    it("HAMYON bilan to'lov hamyonni kamaytiradi (chaqim ham)", async () => {
      await insert([
        { userId: PASSENGER, amount: 50000, type: 'credit', externalId: 'manual_adjustment_1' },
        { userId: PASSENGER, amount: 20000, type: 'debit', method: 'wallet', orderId: ORDER },
        { userId: PASSENGER, amount: 3000, type: 'debit', method: 'wallet', orderId: ORDER, externalId: 'tip' },
      ]);
      await expect(balance(PASSENGER)).resolves.toBe(27000);
    });

    it("sotuvchi komissiyasi va to'ldirish teskarisi (order_id NULL) hisoblanadi", async () => {
      await insert([
        { userId: DRIVER, amount: 100000, type: 'credit', method: 'card', externalId: 'food_order_x' },
        { userId: DRIVER, amount: 10000, type: 'debit', method: 'cash', externalId: 'food_order_commission_x' },
        { userId: DRIVER, amount: 5000, type: 'debit', method: 'card', externalId: 'wallet_topup_reversal_1' },
      ]);
      await expect(balance(DRIVER)).resolves.toBe(85000);
    });

    it('computeWalletBalances va syncDriverBalanceColumn ham AYNAN shunday', async () => {
      await insert([
        { userId: PASSENGER, amount: 5000, type: 'credit', externalId: `referral_bonus_referrer_${ORDER}` },
        { userId: PASSENGER, amount: 20000, type: 'debit', method: 'cash', orderId: ORDER2 },
        { userId: DRIVER, amount: 2000, type: 'debit', method: 'cash', orderId: ORDER, externalId: 'commission' },
      ]);
      const map = await computeWalletBalances(manager, [PASSENGER, DRIVER]);
      expect(map.get(PASSENGER)).toBe(5000);
      expect(map.get(DRIVER)).toBe(-2000);

      await qr.query(`INSERT INTO drivers VALUES (gen_random_uuid(), $1, 0, true)`, [PASSENGER]);
      await expect(syncDriverBalanceColumn(manager, PASSENGER)).resolves.toMatchObject({ balance: 5000, wentOffline: false });
    });
  });

  describe('#2 — bonus yechib olinmaydi, birinchi platforma to\'lovlariga sarflanadi', () => {
    const withdrawable = async (userId: string, holdDays = 7) =>
      computeWithdrawableBalance(manager, userId, await balance(userId), holdDays, new Date('2026-10-16T00:00:00Z'));

    it('haydovchi bonusi 50 000: hammasi bonus, yechib bo\'lmaydi', async () => {
      await insert([{ userId: DRIVER, amount: 50000, type: 'credit', bonusRuleId: RULE }]);
      await expect(withdrawable(DRIVER)).resolves.toEqual({ available: 0, held: 0, bonus: 50000 });
    });

    it('komissiya bonusdan yechiladi; karta daromadi yechiladi', async () => {
      await insert([
        { userId: DRIVER, amount: 50000, type: 'credit', bonusRuleId: RULE },
        { userId: DRIVER, amount: 20000, type: 'credit', method: 'card', orderId: ORDER },
        { userId: DRIVER, amount: 2000, type: 'debit', method: 'card', orderId: ORDER, externalId: 'commission' },
        { userId: DRIVER, amount: 200, type: 'debit', method: 'card', orderId: ORDER, externalId: 'tax_withholding' },
        { userId: DRIVER, amount: 10000, type: 'debit', externalId: 'shift_pass_p1' },
      ]);
      // balance 57 800, bonus 50 000 − 12 200 = 37 800, available 20 000.
      await expect(withdrawable(DRIVER)).resolves.toEqual({ available: 20000, held: 0, bonus: 37800 });
    });

    it("bonusdan OLDINGI komissiya keyingi bonusni yemaydi (xronologik)", async () => {
      await insert([
        { userId: DRIVER, amount: 100000, type: 'credit', method: 'card', orderId: ORDER },
        { userId: DRIVER, amount: 30000, type: 'debit', method: 'card', orderId: ORDER, externalId: 'commission' },
        { userId: DRIVER, amount: 10000, type: 'credit', externalId: `referral_bonus_referrer_${ORDER2}` },
      ]);
      await expect(withdrawable(DRIVER)).resolves.toEqual({ available: 70000, held: 0, bonus: 10000 });
    });

    it("qo'lda tuzatish, smena qaytarimi, yechish qaytarimi — bonus emas", async () => {
      await insert([
        { userId: DRIVER, amount: 7000, type: 'credit', externalId: 'manual_adjustment_a1' },
        { userId: DRIVER, amount: 3000, type: 'credit', externalId: 'shift_pass_refund_p1' },
        { userId: DRIVER, amount: 1000, type: 'credit', externalId: 'withdrawal_refund_w1' },
      ]);
      await expect(withdrawable(DRIVER)).resolves.toEqual({ available: 11000, held: 0, bonus: 0 });
    });

    it("bonusdan berilgan chaqim (tip_bonus) bonus bo'lib qoladi; oddiy chaqim yechiladi", async () => {
      await insert([
        { userId: DRIVER, amount: 4000, type: 'credit', orderId: ORDER, externalId: 'tip_bonus' },
        { userId: DRIVER, amount: 1000, type: 'credit', orderId: ORDER, externalId: 'tip' },
      ]);
      await expect(withdrawable(DRIVER)).resolves.toEqual({ available: 1000, held: 0, bonus: 4000 });
    });

    it("to'lovchining chaqimi uning bonusini yeydi", async () => {
      await insert([
        { userId: PASSENGER, amount: 5000, type: 'credit', externalId: `referral_bonus_passenger_${ORDER}` },
        { userId: PASSENGER, amount: 3000, type: 'debit', orderId: ORDER, externalId: 'tip' },
      ]);
      await expect(computeBonusBalance(manager, PASSENGER)).resolves.toBe(2000);
    });

    it("hamyon safarining bonus qismi (fare_bonus_spend) bonusni yeydi, naqd qismi yemaydi", async () => {
      await insert([
        { userId: PASSENGER, amount: 5000, type: 'credit', externalId: `referral_bonus_passenger_${ORDER}` },
        { userId: PASSENGER, amount: 20000, type: 'credit', method: 'card', externalId: 'wallet_topup_t1' },
        { userId: PASSENGER, amount: 20000, type: 'debit', method: 'wallet', orderId: ORDER },
        { userId: PASSENGER, amount: 4000, type: 'debit', method: 'wallet', orderId: ORDER, externalId: 'fare_bonus_spend' },
      ]);
      await expect(computeBonusBalance(manager, PASSENGER)).resolves.toBe(1000);
      await expect(balance(PASSENGER)).resolves.toBe(1000);
    });

    it('to\'ldirish ushlovi va bonus birga ayiriladi', async () => {
      await insert([
        { userId: DRIVER, amount: 10000, type: 'credit', bonusRuleId: RULE },
        { userId: DRIVER, amount: 50000, type: 'credit', method: 'card', externalId: 'wallet_topup_t1' },
        { userId: DRIVER, amount: 40000, type: 'credit', method: 'card', orderId: ORDER },
      ]);
      await qr.query(`INSERT INTO wallet_topups VALUES ($1, 50000, 'paid', '2026-10-15T00:00:00Z')`, [DRIVER]);
      await expect(withdrawable(DRIVER)).resolves.toEqual({ available: 40000, held: 50000, bonus: 10000 });
      // Hold o'chiq — faqat bonus ayiriladi.
      await expect(withdrawable(DRIVER, 0)).resolves.toEqual({ available: 90000, held: 0, bonus: 10000 });
    });
  });
});
