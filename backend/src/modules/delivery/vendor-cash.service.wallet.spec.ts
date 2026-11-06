import { BadRequestException } from '@nestjs/common';
import { OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import { FoodOrder } from '../../database/entities/food-order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { VendorCashService } from './vendor-cash.service';

/**
 * Hamyon rejimi (e-tijorat qonuni 23-modda, 2026-12-12 dan): olib ketishda
 * kuryer hamyonidan sotuvchi hisobiga o'tkazma — naqd emas.
 *
 * Tovar 145 000 so'm, jami (yetkazish bilan) 152 000, restoran komissiyasi
 * 10% → komissiya round(152 000 × 10%) = 15 200 (bugungi formula).
 */
describe('VendorCashService — hamyon rejimi', () => {
  const ride = (over: Record<string, unknown> = {}) => ({
    id: 'ride-1',
    driverId: 'courier-1',
    status: OrderStatus.ARRIVED,
    paymentMethod: PaymentMethod.CASH,
    details: { foodOrderId: 'fo-1', payVendor: 145000 },
    ...over,
  });

  let foodOrder: Record<string, unknown>;
  let ledger: Array<Partial<Transaction>>;
  let courierBalance: number;
  let mode: 'cash' | 'wallet';
  let foodRepo: { findOne: jest.Mock; update: jest.Mock };
  let gateway: { emitToUser: jest.Mock; emitToManagers: jest.Mock };
  let service: VendorCashService;

  beforeEach(() => {
    mode = 'wallet';
    courierBalance = 200000;
    ledger = [];
    foodOrder = {
      id: 'fo-1',
      restaurantId: 'r1',
      paymentMethod: 'cash',
      totalPrice: 152000,
      vendorCashPaidAt: null,
      vendorCashConfirmedAt: null,
      vendorCashDisputedAt: null,
      vendorCashDisputeResolvedAt: null,
      vendorWalletSettledAt: null,
    };
    foodRepo = { findOne: jest.fn(async () => ({ ...foodOrder })), update: jest.fn() };
    gateway = { emitToUser: jest.fn(), emitToManagers: jest.fn() };

    const txRepo = {
      createQueryBuilder: () => {
        const qb = {
          select: () => qb,
          where: () => qb,
          getRawOne: async () => ({ balance: String(courierBalance) }),
        };
        return qb;
      },
      save: jest.fn(async (row: Partial<Transaction>) => {
        ledger.push(row);
        return row;
      }),
    };

    const manager = {
      query: jest.fn().mockResolvedValue([]),
      // Conditional write — only the first settlement wins.
      update: jest.fn(async (entity: unknown, criteria: { id: string }, changes: Record<string, unknown>) => {
        expect(entity).toBe(FoodOrder);
        if (foodOrder.vendorWalletSettledAt) return { affected: 0 };
        foodOrder = { ...foodOrder, ...changes };
        return { affected: 1 };
      }),
      getRepository: jest.fn(() => txRepo),
    };
    const dataSource = {
      getRepository: jest.fn(() => txRepo),
      transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) => {
        const snapshot = { ...foodOrder };
        const ledgerSize = ledger.length;
        try {
          return await cb(manager);
        } catch (err) {
          foodOrder = snapshot; // rollback
          ledger.length = ledgerSize;
          throw err;
        }
      }),
    };

    service = new VendorCashService(
      { findOne: jest.fn().mockResolvedValue(ride()) } as never,
      foodRepo as never,
      { findOne: jest.fn(), update: jest.fn() } as never,
      {
        findOne: jest.fn().mockResolvedValue({ id: 'r1', ownerUserId: 'owner-1', name: 'Mix Burger', commissionRate: 10 }),
      } as never,
      { findOne: jest.fn() } as never,
      gateway as never,
      { getEffectiveVendorSettlementMode: jest.fn(async () => mode) } as never,
      dataSource as never,
    );
  });

  describe('kuryer "to\'ladim" (olib ketish)', () => {
    it('kuryer hamyonidan yechadi, sotuvchiga tovar − komissiya; tasdiq shart emas', async () => {
      const result = await service.markPaidByCourier('courier-1', 'ride-1');

      expect(result).toEqual({ amount: 145000, method: 'wallet' });
      expect(ledger).toEqual([
        expect.objectContaining({
          userId: 'courier-1',
          amount: 145000,
          type: TransactionType.DEBIT,
          paymentMethod: PaymentMethod.WALLET,
          status: TransactionStatus.COMPLETED,
          externalId: 'vendor_settlement_debit_fo-1',
        }),
        expect.objectContaining({
          userId: 'owner-1',
          amount: 145000,
          type: TransactionType.CREDIT,
          externalId: 'vendor_settlement_credit_fo-1',
        }),
        expect.objectContaining({
          userId: 'owner-1',
          amount: 14500,
          type: TransactionType.DEBIT,
          externalId: 'vendor_settlement_commission_fo-1',
        }),
      ]);
      expect(foodOrder.vendorWalletSettledAt).toBeInstanceOf(Date);
      expect(foodOrder.vendorCashPaidAt).toBeInstanceOf(Date);
      expect(foodOrder.vendorCashConfirmedAt).toBeInstanceOf(Date);
      expect(gateway.emitToUser).toHaveBeenCalledWith(
        'owner-1',
        'vendor:wallet_settled',
        expect.objectContaining({ vendorOrderId: 'fo-1', amount: 145000, commission: 14500, net: 130500 }),
      );
    });

    it('takroriy bosish — ikkinchi marta yechilmaydi (idempotent)', async () => {
      await service.markPaidByCourier('courier-1', 'ride-1');
      await service.markPaidByCourier('courier-1', 'ride-1');
      expect(ledger).toHaveLength(3);
    });

    it('balans yetmasa — o‘zbekcha 400, hech narsa yozilmaydi', async () => {
      courierBalance = 100000;
      const error = await service.markPaidByCourier('courier-1', 'ride-1').catch((e) => e);
      expect(error.message).toMatch(/Hamyonda mablag' yetarli emas/);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          code: 'WALLET_INSUFFICIENT_FOR_VENDOR',
          details: { required: 145000, balance: 100000 },
        }),
      );
      expect(ledger).toHaveLength(0);
      expect(foodOrder.vendorWalletSettledAt).toBeNull();
    });
  });

  describe('safarni boshlash', () => {
    it('hamyon rejimida to‘lanmagan bo‘lsa — o‘tkazma avtomatik bajariladi', async () => {
      await service.assertReadyForPickup(ride() as never);
      expect(ledger).toHaveLength(3);
    });

    it('balans yetmasa — boshlab bo‘lmaydi', async () => {
      courierBalance = 0;
      await expect(service.assertReadyForPickup(ride() as never)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('qabul qilish', () => {
    it('hamyon rejimida balans tovar summasidan kam — qabul qilib bo‘lmaydi', async () => {
      courierBalance = 100000;
      await expect(service.assertCanAccept('courier-1', ride() as never)).rejects.toThrow(
        /do'konga 145 000 so'm/,
      );
    });

    it('yetarli balans — mumkin', async () => {
      await expect(service.assertCanAccept('courier-1', ride() as never)).resolves.toBeUndefined();
    });

    it('naqd rejimda yoki karta buyurtmasida tekshirilmaydi', async () => {
      courierBalance = 0;
      await expect(
        service.assertCanAccept('courier-1', ride({ details: { foodOrderId: 'fo-1', payVendor: 0 } }) as never),
      ).resolves.toBeUndefined();
      mode = 'cash';
      await expect(service.assertCanAccept('courier-1', ride() as never)).resolves.toBeUndefined();
    });
  });

  describe('sotuvchi qarori', () => {
    it('hamyon orqali to‘langan buyurtmada "oldim/olmadim" so‘ralmaydi', async () => {
      await service.markPaidByCourier('courier-1', 'ride-1');
      await expect(service.vendorDecision('owner-1', 'food', 'fo-1', false)).rejects.toThrow(/hamyoni orqali/i);
      expect(gateway.emitToManagers).not.toHaveBeenCalled();
    });
  });

  describe('naqd rejim', () => {
    it('bugungi xulq: faqat belgi, pul harakati yo‘q', async () => {
      mode = 'cash';
      const result = await service.markPaidByCourier('courier-1', 'ride-1');
      expect(result).toEqual({ amount: 145000, method: 'cash' });
      expect(ledger).toHaveLength(0);
      expect(foodRepo.update).toHaveBeenCalledWith('fo-1', { vendorCashPaidAt: expect.any(Date) });
    });
  });
});
