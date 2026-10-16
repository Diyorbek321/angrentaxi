import { Order } from '../../database/entities/order.entity';
import { Repository } from 'typeorm';
import { creditReferralBonus, REFERRAL_BONUS_AMOUNT } from './referral-bonus';

/**
 * Menejer tasdiqlaganda referal bonusi (`OrderFraudService.review`).
 * Ikkala qator (yo'lovchi + taklif qilgan) BITTA tranzaksiyada; unikal indeks
 * (`uq_transactions_referral_bonus`, migratsiya 033) takrorni rad etsa —
 * "allaqachon berilgan" (false), xato emas.
 */
describe('creditReferralBonus', () => {
  function build(opts: { saveError?: Error } = {}) {
    const saved: Array<Record<string, unknown>> = [];
    const txManager = {
      query: jest.fn(async () => [[], 0]),
      getRepository: () => ({
        save: jest.fn(async (row: Record<string, unknown>) => {
          if (opts.saveError) throw opts.saveError;
          saved.push(row);
          return row;
        }),
      }),
    };
    const transaction = jest.fn(async (cb: (m: unknown) => unknown) => cb(txManager));
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM users')) return [{ referred_by_user_id: 'referrer-1' }];
      if (sql.includes('referral_bonus_passenger_')) return [];
      if (sql.includes('FROM orders')) return [{ id: 'order-1' }];
      return [];
    });
    const repo = { query, manager: { transaction } } as unknown as Repository<Order>;
    return { repo, saved, transaction };
  }

  it("ikkala bonus qatori BITTA tranzaksiyada yoziladi", async () => {
    const { repo, saved, transaction } = build();
    await expect(creditReferralBonus(repo, 'passenger-1', 'order-1')).resolves.toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(saved.map((r) => r.externalId)).toEqual([
      'referral_bonus_passenger_order-1',
      'referral_bonus_referrer_order-1',
    ]);
    expect(saved.every((r) => r.amount === REFERRAL_BONUS_AMOUNT)).toBe(true);
  });

  it('unikal indeks takrorni rad etsa (23505) — false, xato otilmaydi', async () => {
    const { repo } = build({ saveError: Object.assign(new Error('duplicate key'), { code: '23505' }) });
    await expect(creditReferralBonus(repo, 'passenger-1', 'order-1')).resolves.toBe(false);
  });

  it('boshqa xato yuqoriga otiladi', async () => {
    const { repo } = build({ saveError: new Error('db down') });
    await expect(creditReferralBonus(repo, 'passenger-1', 'order-1')).rejects.toThrow('db down');
  });
});
