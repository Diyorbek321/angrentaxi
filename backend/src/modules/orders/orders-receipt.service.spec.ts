import { BadRequestException } from '@nestjs/common';
import {
  Order,
  OrderStatus,
  PaymentMethod,
} from '../../database/entities/order.entity';
import {
  TIP_LEDGER_TAG,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { UserRole } from '../../database/entities/user.entity';
import { OrdersReceiptService } from './orders-receipt.service';

const ORDER = 'order-1';
const PASSENGER = 'passenger-1';
const USER = { id: PASSENGER, role: UserRole.PASSENGER };

const FARE = {
  baseFare: 10000,
  distanceKm: 7.4,
  pricePerKm: 2000,
  distanceFare: 14800,
  durationMin: 18,
  pricePerMin: 500,
  timeFare: 9000,
  minPriceAdjustment: 0,
  surgeMultiplier: 1.4,
  surgeFare: 13520,
  maxPriceCap: 0,
  total: 47320,
};

describe('OrdersReceiptService', () => {
  const build = (
    order: Partial<Order>,
    opts: {
      trip?: unknown;
      /** Buyurtmaning DEBIT qatorlari, YANGISI BIRINCHI (repo tartibi). */
      charges?: unknown[];
      promoCode?: string | null;
    } = {},
  ) => {
    const full = {
      id: ORDER,
      passengerId: PASSENGER,
      status: OrderStatus.COMPLETED,
      finalPrice: 42320,
      discountAmount: 5000,
      completedAt: new Date('2026-08-19T10:00:00Z'),
      surgeMultiplier: 1.4,
      fareBreakdown: FARE,
      tipAmount: null,
      paymentMethod: PaymentMethod.CASH,
      pickupAddress: 'Chorsu',
      dropoffAddress: 'Bekat',
      waypoints: null,
      tariffId: 'tariff-1',
      tariff: { name: 'Komfort' },
      driver: null,
      ...order,
    } as unknown as Order;

    return new OrdersReceiptService(
      { findOne: jest.fn().mockResolvedValue(opts.trip ?? null) } as never,
      { find: jest.fn().mockResolvedValue(opts.charges ?? []) } as never,
      {
        findOne: jest.fn().mockResolvedValue({
          ...full,
          promoCode: opts.promoCode ? { code: opts.promoCode } : null,
        }),
      } as never,
      { findByIdForUser: jest.fn().mockResolvedValue(full) } as never,
    );
  };

  it('tugamagan safar uchun chek berilmaydi', async () => {
    const service = build({ status: OrderStatus.IN_PROGRESS });
    await expect(service.getReceipt(ORDER, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('qisqa buyurtma raqamini UUID ning birinchi bo\'lagidan yasaydi', async () => {
    const service = build({ id: 'a3f9c1d2-1111-2222-3333-444444444444' });
    const receipt = await service.getReceipt(ORDER, USER);
    expect(receipt.orderNumber).toBe('A3F9C1D2');
  });

  it('narx tarkibini o\'zgartirmasdan uzatadi', async () => {
    const service = build({});
    const receipt = await service.getReceipt(ORDER, USER);
    expect(receipt.fare).toEqual(FARE);
    expect(receipt.surgeMultiplier).toBe(1.4);
  });

  it('eski safarda tarkib null bo\'ladi — soxta tarkib O\'YLAB TOPILMAYDI', async () => {
    const service = build({ fareBreakdown: null });
    const receipt = await service.getReceipt(ORDER, USER);
    expect(receipt.fare).toBeNull();
    // Qolgan maydonlar baribir to'ldiriladi — chek qisman ko'rsatiladi.
    expect(receipt.total).toBe(42320);
  });

  it('chegirmagacha summa = yakuniy + chegirma', async () => {
    const service = build({ finalPrice: 42320, discountAmount: 5000 });
    const receipt = await service.getReceipt(ORDER, USER);
    expect(receipt.grossPrice).toBe(47320);
    expect(receipt.discountAmount).toBe(5000);
    expect(receipt.total).toBe(42320);
  });

  it('masofa va davomiylikni trips dan oladi', async () => {
    const service = build({}, {
      trip: { actualDistanceKm: 7.4, actualDurationMin: 18 },
    });
    const receipt = await service.getReceipt(ORDER, USER);
    expect(receipt.distanceKm).toBe(7.4);
    expect(receipt.durationMin).toBe(18);
  });

  it('promokod matnini alohida yuklamadan oladi', async () => {
    const service = build({}, { promoCode: 'YANGI25' });
    const receipt = await service.getReceipt(ORDER, USER);
    expect(receipt.promoCode).toBe('YANGI25');
  });

  describe('to\'lov holati', () => {
    it('PENDING DEBIT to\'lanmagan qoldiq sifatida ko\'rsatiladi', async () => {
      const service = build({}, {
        charges: [
          {
            status: TransactionStatus.PENDING,
            amount: 42320,
            type: TransactionType.DEBIT,
            externalId: null,
          },
        ],
      });
      const receipt = await service.getReceipt(ORDER, USER);
      expect(receipt.paymentStatus).toBe(TransactionStatus.PENDING);
      expect(receipt.unpaidAmount).toBe(42320);
    });

    it('COMPLETED DEBIT da qoldiq nol', async () => {
      const service = build({}, {
        charges: [
          {
            status: TransactionStatus.COMPLETED,
            amount: 42320,
            type: TransactionType.DEBIT,
            externalId: null,
          },
        ],
      });
      const receipt = await service.getReceipt(ORDER, USER);
      expect(receipt.unpaidAmount).toBe(0);
    });

    // ⚠️ REGRESSIYA: chaqim ham AYNI SHU buyurtmaga yo'lovchi nomidan DEBIT
    // yozadi va u yo'l haqidan KEYIN keladi. Eng oxirgi DEBIT olinsa, chek
    // to'lanmagan yo'l haqini COMPLETED chaqim bilan yopib ko'rsatib,
    // qarzni YASHIRIB qo'yardi.
    it('chaqim DEBITi yo\'l haqi holatini bosib ketmaydi', async () => {
      const service = build({ tipAmount: 5000 }, {
        charges: [
          // Yangisi birinchi — repo `createdAt: DESC` bilan qaytaradi.
          {
            status: TransactionStatus.COMPLETED,
            amount: 5000,
            type: TransactionType.DEBIT,
            externalId: TIP_LEDGER_TAG,
          },
          {
            status: TransactionStatus.PENDING,
            amount: 42320,
            type: TransactionType.DEBIT,
            externalId: null,
          },
        ],
      });
      const receipt = await service.getReceipt(ORDER, USER);
      expect(receipt.paymentStatus).toBe(TransactionStatus.PENDING);
      expect(receipt.unpaidAmount).toBe(42320);
    });

    it('daftar qatori topilmasa holat null, qoldiq nol', async () => {
      const service = build({});
      const receipt = await service.getReceipt(ORDER, USER);
      expect(receipt.paymentStatus).toBeNull();
      expect(receipt.unpaidAmount).toBe(0);
    });
  });

  it('chaqim chekda alohida ko\'rsatiladi', async () => {
    const service = build({ tipAmount: 5000 });
    const receipt = await service.getReceipt(ORDER, USER);
    expect(receipt.tipAmount).toBe(5000);
  });

  it('chekda komissiya va haydovchi daromadi YO\'Q', async () => {
    // Chek — yo'lovchi hujjati. Platforma qancha ushlab qolgani unga
    // tegishli emas.
    const service = build({ driverEarning: 30000 });
    const receipt = await service.getReceipt(ORDER, USER);
    expect(receipt).not.toHaveProperty('driverEarning');
    expect(receipt).not.toHaveProperty('commission');
  });

  it('haydovchi ma\'lumotini identifikatsiya uchun beradi', async () => {
    const service = build({
      driver: {
        firstName: 'Alisher',
        lastName: 'Karimov',
        carModel: 'Cobalt',
        carNumber: '01A123BC',
      },
    } as unknown as Partial<Order>);
    const receipt = await service.getReceipt(ORDER, USER);
    expect(receipt.driver).toEqual({
      name: 'Alisher Karimov',
      carModel: 'Cobalt',
      carNumber: '01A123BC',
    });
  });
});
