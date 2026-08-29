import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  Order,
  OrderStatus,
  PaymentMethod,
} from '../../database/entities/order.entity';
import {
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { OrdersTipsService } from './orders-tips.service';

/**
 * Chaqim — pul harakati, shuning uchun testlar "ishladimi" emas,
 * "DAFTARGA NIMA YOZILDI" ni tekshiradi.
 */

const PASSENGER = 'passenger-1';
const DRIVER = 'driver-1';
const ORDER = 'order-1';

// `computeWalletBalance` va `lockWalletForUpdate` — util funksiyalar,
// shuning uchun modul darajasida almashtiriladi.
let mockBalance = 100000;
jest.mock('../payments/wallet-balance.util', () => ({
  computeWalletBalance: jest.fn(async () => mockBalance),
  // Chaqim yo'lovchining hamyonidan SARFLANADI, ya'ni qirqilgan qoldiq
  // ishlatiladi — manfiy balans hech qachon "sarflasa bo'ladi" bo'lib
  // o'qilmasligi kerak.
  computeSpendableBalance: jest.fn(async () => Math.max(0, mockBalance)),
  lockWalletForUpdate: jest.fn(async () => undefined),
}));

describe('OrdersTipsService', () => {
  let service: OrdersTipsService;
  let savedRows: Array<Record<string, unknown>>;
  let orderUpdates: Array<Record<string, unknown>>;
  let adjustBalanceWithin: jest.Mock;
  let emitToUser: jest.Mock;
  let freshOrder: Partial<Order> | null;

  const baseOrder = (over: Partial<Order> = {}): Order =>
    ({
      id: ORDER,
      passengerId: PASSENGER,
      driverId: DRIVER,
      status: OrderStatus.COMPLETED,
      completedAt: new Date(),
      tipAmount: null,
      ...over,
    }) as Order;

  const build = (order: Order) => {
    savedRows = [];
    orderUpdates = [];
    adjustBalanceWithin = jest.fn().mockResolvedValue(undefined);
    emitToUser = jest.fn();
    freshOrder = { tipAmount: null };

    const manager = {
      query: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(async () => freshOrder),
      update: jest.fn(async (_e: unknown, _id: unknown, patch: unknown) => {
        orderUpdates.push(patch as Record<string, unknown>);
        return { affected: 1 };
      }),
      getRepository: () => ({
        save: jest.fn(async (row: Record<string, unknown>) => {
          savedRows.push(row);
          return row;
        }),
      }),
    } as unknown as EntityManager;

    return new OrdersTipsService(
      {} as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      {
        transaction: async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
      } as never,
      { adjustBalanceWithin } as never,
      { emitToUser } as never,
      { findByIdOrThrow: jest.fn().mockResolvedValue(order) } as never,
    );
  };

  beforeEach(() => {
    mockBalance = 100000;
  });

  describe('ruxsat va holat tekshiruvlari', () => {
    it('boshqa yo\'lovchining safariga chaqim berib bo\'lmaydi', async () => {
      service = build(baseOrder({ passengerId: 'someone-else' }));
      await expect(
        service.addTip(PASSENGER, ORDER, { amount: 5000 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('tugamagan safarga chaqim berib bo\'lmaydi', async () => {
      service = build(baseOrder({ status: OrderStatus.IN_PROGRESS }));
      await expect(
        service.addTip(PASSENGER, ORDER, { amount: 5000 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('haydovchisiz buyurtmaga chaqim berib bo\'lmaydi', async () => {
      service = build(baseOrder({ driverId: null }));
      await expect(
        service.addTip(PASSENGER, ORDER, { amount: 5000 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('24 soatdan keyin chaqim qabul qilinmaydi', async () => {
      const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
      service = build(baseOrder({ completedAt: old }));
      await expect(
        service.addTip(PASSENGER, ORDER, { amount: 5000 }),
      ).rejects.toThrow(/24 soat/);
    });

    it('ikkinchi marta chaqim berib bo\'lmaydi', async () => {
      service = build(baseOrder());
      freshOrder = { tipAmount: 5000 };
      await expect(
        service.addTip(PASSENGER, ORDER, { amount: 3000 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('mablag\' yetmasligi', () => {
    it('hamyon yetmasa RAD ETILADI — qarz YOZILMAYDI', async () => {
      // Bu eng muhim qoida: PENDING hamyon qarzi
      // `getOutstandingWalletDebt` orqali yo'lovchini keyingi buyurtmadan
      // bloklaydi, ya'ni ixtiyoriy chaqim majburiy to'lovga aylanardi.
      mockBalance = 1000;
      service = build(baseOrder());

      await expect(
        service.addTip(PASSENGER, ORDER, { amount: 5000 }),
      ).rejects.toThrow(/yetarli emas/);

      expect(savedRows).toHaveLength(0);
      expect(adjustBalanceWithin).not.toHaveBeenCalled();
      expect(orderUpdates).toHaveLength(0);
    });
  });

  describe('muvaffaqiyatli chaqim', () => {
    beforeEach(async () => {
      service = build(baseOrder());
      await service.addTip(PASSENGER, ORDER, { amount: 5000 });
    });

    it('AYNAN ikkita daftar qatori yozadi — komissiya qatori YO\'Q', () => {
      // Chaqim komissiyasiz. Uchinchi qator paydo bo'lsa, kimdir komissiya
      // qo'shgan bo'ladi va bu test aynan shuni tutadi.
      expect(savedRows).toHaveLength(2);
      expect(
        savedRows.some((r) => r.externalId === 'commission'),
      ).toBe(false);
    });

    it('yo\'lovchidan DEBIT, haydovchiga CREDIT — ikkalasi ham COMPLETED', () => {
      const debit = savedRows.find((r) => r.type === TransactionType.DEBIT)!;
      const credit = savedRows.find((r) => r.type === TransactionType.CREDIT)!;

      expect(debit).toMatchObject({
        userId: PASSENGER,
        orderId: ORDER,
        amount: 5000,
        status: TransactionStatus.COMPLETED,
        paymentMethod: PaymentMethod.WALLET,
        externalId: 'tip',
      });
      expect(credit).toMatchObject({
        userId: DRIVER,
        amount: 5000,
        status: TransactionStatus.COMPLETED,
        externalId: 'tip',
      });
    });

    it('haydovchi balansiga TO\'LIQ summa qo\'shiladi', () => {
      expect(adjustBalanceWithin).toHaveBeenCalledWith(
        expect.anything(),
        DRIVER,
        5000,
      );
    });

    it('buyurtmaga chaqim yoziladi, driverEarning TEGILMAYDI', () => {
      // `driverEarning` — komissiya ayirilgan sof yo'l haqi. Chaqim u yerga
      // qo'shilsa daromad hisoboti buziladi.
      const patch = orderUpdates[0];
      expect(patch).toMatchObject({
        tipAmount: 5000,
        tipPaymentMethod: PaymentMethod.WALLET,
      });
      expect(patch).not.toHaveProperty('driverEarning');
      expect(patch.tipPaidAt).toBeInstanceOf(Date);
    });

    it('haydovchiga real vaqt xabari yuboriladi', () => {
      expect(emitToUser).toHaveBeenCalledWith(DRIVER, 'order:tip', {
        orderId: ORDER,
        amount: 5000,
      });
    });
  });

  it('xabar yuborish yiqilsa ham chaqim bekor qilinmaydi', async () => {
    service = build(baseOrder());
    emitToUser.mockImplementation(() => {
      throw new Error('socket down');
    });

    await expect(
      service.addTip(PASSENGER, ORDER, { amount: 5000 }),
    ).resolves.toMatchObject({ tipAmount: 5000 });
    expect(savedRows).toHaveLength(2);
  });
});
