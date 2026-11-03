import { BadRequestException } from '@nestjs/common';
import {
  CARD_PAYMENT_PENDING_MESSAGE,
  assertCheckoutPaymentAllowed,
  assertVendorOrderPaid,
  cardPaymentPending,
  closePendingCardPayments,
  isVendorOrderPaid,
  paidCardOrderIds,
} from './vendor-card-payment';
import { TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { PaymentMethod } from '../../database/entities/order.entity';

/** Kartali buyurtma — to'lovdan oldin sotuvchiga ketmaydi (docs/INCIDENT-POLICY.md §1). */
describe('vendor-card-payment', () => {
  const card = { id: 'o1', customerId: 'c1', paymentMethod: 'card', status: 'new' };
  const cash = { ...card, id: 'o2', paymentMethod: 'cash' };

  describe('isVendorOrderPaid', () => {
    it("naqd buyurtma — to'lov kutilmaydi, so'rov ham yo'q", async () => {
      const repo = { count: jest.fn() };
      await expect(isVendorOrderPaid(repo, cash)).resolves.toBe(true);
      expect(repo.count).not.toHaveBeenCalled();
    });

    it('karta: faqat mijozning COMPLETED karta DEBIT qatori hisoblanadi', async () => {
      const repo = { count: jest.fn().mockResolvedValue(0) };
      await expect(isVendorOrderPaid(repo, card)).resolves.toBe(false);
      expect(repo.count).toHaveBeenCalledWith({
        where: {
          orderId: 'o1',
          userId: 'c1',
          type: TransactionType.DEBIT,
          paymentMethod: PaymentMethod.CARD,
          status: TransactionStatus.COMPLETED,
        },
      });
      repo.count.mockResolvedValue(1);
      await expect(isVendorOrderPaid(repo, card)).resolves.toBe(true);
    });
  });

  it("assertVendorOrderPaid — to'lanmagan karta rad etiladi", async () => {
    await expect(assertVendorOrderPaid({ count: jest.fn().mockResolvedValue(0) }, card)).rejects.toThrow(
      CARD_PAYMENT_PENDING_MESSAGE,
    );
    await expect(assertVendorOrderPaid({ count: jest.fn().mockResolvedValue(1) }, card)).resolves.toBeUndefined();
  });

  describe('paidCardOrderIds', () => {
    it("kartali buyurtma yo'q — so'rov yo'q", async () => {
      const repo = { find: jest.fn() };
      await expect(paidCardOrderIds(repo, [cash])).resolves.toEqual(new Set());
      expect(repo.find).not.toHaveBeenCalled();
    });

    it("bitta so'rov; boshqa foydalanuvchining qatori hisoblanmaydi", async () => {
      const repo = {
        find: jest.fn().mockResolvedValue([
          { orderId: 'o1', userId: 'c1' },
          { orderId: 'o3', userId: 'someone-else' },
        ]),
      };
      const result = await paidCardOrderIds(repo, [card, cash, { ...card, id: 'o3' }]);
      expect(result).toEqual(new Set(['o1']));
      expect(repo.find).toHaveBeenCalledTimes(1);
    });
  });

  it("cardPaymentPending — faqat to'lanmagan, bekor qilinmagan karta", () => {
    expect(cardPaymentPending(card, false)).toBe(true);
    expect(cardPaymentPending(card, true)).toBe(false);
    expect(cardPaymentPending(cash, false)).toBe(false);
    expect(cardPaymentPending({ ...card, status: 'cancelled' }, false)).toBe(false);
  });

  it("closePendingCardPayments — faqat PENDING karta qatorlari FAILED bo'ladi", async () => {
    const repo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    await closePendingCardPayments(repo, card);
    expect(repo.update).toHaveBeenCalledWith(
      {
        orderId: 'o1',
        userId: 'c1',
        type: TransactionType.DEBIT,
        paymentMethod: PaymentMethod.CARD,
        status: TransactionStatus.PENDING,
      },
      { status: TransactionStatus.FAILED },
    );
  });

  describe('assertCheckoutPaymentAllowed', () => {
    const base = { totalPrice: 100000, cashLimit: 200000, cashLimitApplies: true };

    it('karta mavjud: karta ham, chegaradagi naqd ham o\'tadi', () => {
      expect(() => assertCheckoutPaymentAllowed({ ...base, isCash: false, cardAvailable: true })).not.toThrow();
      expect(() => assertCheckoutPaymentAllowed({ ...base, isCash: true, cardAvailable: true })).not.toThrow();
    });

    it('karta mavjud emas: kartali buyurtma rad etiladi', () => {
      expect(() => assertCheckoutPaymentAllowed({ ...base, isCash: false, cardAvailable: false })).toThrow(
        /Karta orqali to'lov hozircha mavjud emas/,
      );
    });

    it("karta mavjud: chegaradan oshgan naqd — 'karta bilan to'lang'", () => {
      expect(() =>
        assertCheckoutPaymentAllowed({ ...base, totalPrice: 250000, isCash: true, cardAvailable: true }),
      ).toThrow(/karta bilan to'lang/);
    });

    it("karta yo'q va savat chegaradan oshgan — buyurtma berib bo'lmaydi (naqd ham, karta ham)", () => {
      for (const isCash of [true, false]) {
        let error: unknown;
        try {
          assertCheckoutPaymentAllowed({ ...base, totalPrice: 250000, isCash, cardAvailable: false });
        } catch (err) {
          error = err;
        }
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as Error).message).toBe(
          "Naqd to'lov 200 000 so'mgacha, karta orqali to'lov esa hozircha mavjud emas — savatni kamaytiring.",
        );
      }
    });

    it("do'konning o'z kuryeri: naqd chegarasi qo'llanmaydi", () => {
      expect(() =>
        assertCheckoutPaymentAllowed({
          ...base,
          totalPrice: 250000,
          cashLimitApplies: false,
          isCash: true,
          cardAvailable: false,
        }),
      ).not.toThrow();
    });
  });
});
