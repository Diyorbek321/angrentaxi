import { Repository } from 'typeorm';
import {
  FARE_BONUS_LEDGER_TAG,
  FARE_BONUS_SPEND_LEDGER_TAG,
  TIP_BONUS_LEDGER_TAG,
  TIP_LEDGER_TAG,
  Transaction,
} from '../../database/entities/transaction.entity';
import { TAX_WITHHOLDING_LEDGER_TAG } from '../tax/tax-withholding';
import { SHIFT_PASS_LEDGER_PREFIX, SHIFT_PASS_REFUND_LEDGER_PREFIX } from '../shift-passes/shift-passes.service';
import { REFUND_CLAWBACK_TAG } from './order-refund-clawback.service';
import { VENDOR_SETTLEMENT_TAG } from '../delivery/vendor-wallet-settlement';
import {
  computeBonusBalance,
  computeWalletBalance,
  computeWalletBalances,
  computeWithdrawableBalance,
  syncDriverBalanceColumn,
} from './wallet-balance.util';

/**
 * Bonus pul YECHIB OLINMAYDI (egasi tasdiqlagan qaror) va yo'lovchining
 * naqd/karta to'lovi hamyonni kamaytirmaydi. SQL bu yerda mock — raqamlar
 * bilan isbot `wallet-balance.ledger-sql.spec.ts` da (haqiqiy Postgres).
 * Bu fayl SQL'da kerakli belgilar AYNAN borligini va arifmetikani ushlaydi.
 */
describe('bonus — yechib olinmaydigan qoldiq', () => {
  it('available = max(0, balance − held − bonus); bitta so\'rov; bonus javobda', async () => {
    const manager = { query: jest.fn().mockResolvedValue([{ held: '30000', bonus: '20000' }]) };
    await expect(computeWithdrawableBalance(manager, 'u1', 100000, 7)).resolves.toEqual({
      available: 50000,
      held: 30000,
      bonus: 20000,
    });
    expect(manager.query).toHaveBeenCalledTimes(1);

    await expect(computeWithdrawableBalance(manager, 'u1', 40000, 7)).resolves.toMatchObject({ available: 0 });
  });

  it('hold o\'chiq (0 kun) bo\'lsa ham bonus ayiriladi', async () => {
    const manager = { query: jest.fn().mockResolvedValue([{ held: '0', bonus: '5000' }]) };
    await expect(computeWithdrawableBalance(manager, 'u1', 8000, 0)).resolves.toEqual({
      available: 3000,
      held: 0,
      bonus: 5000,
    });
    // Hold yo'q — `since` parametri NULL, ya'ni hech qaysi to'ldirish ushlanmaydi.
    const params = (manager.query.mock.calls[0] as unknown as [string, unknown[]])[1];
    expect(params).toEqual(['u1', null]);
  });

  it('bonus SQL: bonus kirimlari va bonusni yeydigan platforma to\'lovlari AYNI belgilar bilan', async () => {
    const manager = { query: jest.fn().mockResolvedValue([{ bonus: '0' }]) };
    await computeBonusBalance(manager, 'u1');
    const sql = (manager.query.mock.calls[0] as unknown as [string])[0];
    // Bonus kirimi: haydovchi bonusi, referal, bonusdan berilgan chaqim.
    expect(sql).toContain('bonus_rule_id IS NOT NULL');
    expect(sql).toContain("external_id LIKE 'referral_bonus_%'");
    expect(sql).toContain(`'${TIP_BONUS_LEDGER_TAG}'`);
    expect(sql).toContain(`'${FARE_BONUS_LEDGER_TAG}'`);
    // Bonusni yeydigan chiqimlar.
    for (const tag of ['commission', TAX_WITHHOLDING_LEDGER_TAG, TIP_LEDGER_TAG, FARE_BONUS_SPEND_LEDGER_TAG]) {
      expect(sql).toContain(`'${tag}'`);
    }
    expect(sql).toContain(`'${SHIFT_PASS_LEDGER_PREFIX}%'`);
    expect(sql).toContain(`'${SHIFT_PASS_REFUND_LEDGER_PREFIX}%'`);
    expect(sql).toContain(`'${VENDOR_SETTLEMENT_TAG.vendorCommission('')}%'`);
    expect(sql).toContain("'food_order_commission_%'");
    expect(sql).toContain("'market_order_commission_%'");
    // Xronologik: oldingi komissiya keyingi bonusni "yemaydi".
    expect(sql).toContain('OVER (ORDER BY created_at');
  });

  it('computeBonusBalance — so\'rov natijasini o\'qiydi, qatorsiz 0', async () => {
    await expect(computeBonusBalance({ query: jest.fn().mockResolvedValue([{ bonus: '4500.00' }]) }, 'u1')).resolves.toBe(4500);
    await expect(computeBonusBalance({ query: jest.fn().mockResolvedValue([]) }, 'u1')).resolves.toBe(0);
  });
});

describe("to'lovchi tomonidagi naqd/karta to'lovi hamyonni kamaytirmaydi", () => {
  const PAYER_EXCLUSION = "payment_method IN ('cash', 'card')";

  it('computeWalletBalance — mijoz to\'lovi chiqarib tashlanadi, haydovchi komissiyasi/soliq/clawback qoladi', async () => {
    let selected = '';
    interface Qb {
      select: (expr: string) => Qb;
      where: () => Qb;
      getRawOne: () => Promise<{ balance: string }>;
    }
    const qb: Qb = {
      select: (expr: string) => {
        selected = expr;
        return qb;
      },
      where: () => qb,
      getRawOne: async () => ({ balance: '5000' }),
    };
    const repo = { createQueryBuilder: () => qb } as unknown as Repository<Transaction>;
    await expect(computeWalletBalance(repo, 'u1')).resolves.toBe(5000);
    expect(selected).toContain(PAYER_EXCLUSION);
    expect(selected).toContain('order_id IS NOT NULL');
    expect(selected).toContain(`'commission'`);
    expect(selected).toContain(`'${TAX_WITHHOLDING_LEDGER_TAG}'`);
    expect(REFUND_CLAWBACK_TAG.driver('o1').startsWith('refund_clawback_')).toBe(true);
    expect(selected).toContain(`'refund_clawback_%'`);
  });

  it('computeWalletBalances va syncDriverBalanceColumn AYNI formuladan', async () => {
    const many = { query: jest.fn().mockResolvedValue([]) };
    await computeWalletBalances(many, ['a']);
    const sync = { query: jest.fn().mockResolvedValue([[], 0]) };
    await syncDriverBalanceColumn(sync, 'a');
    for (const m of [many, sync]) {
      const sql = (m.query.mock.calls[0] as unknown as [string])[0];
      expect(sql).toContain(PAYER_EXCLUSION);
    }
  });
});
