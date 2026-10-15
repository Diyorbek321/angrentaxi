import { FoodOrder } from '../../database/entities/food-order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import {
  VENDOR_SETTLEMENT_TAG,
  reverseVendorWalletSettlement,
  settleVendorViaWallet,
} from './vendor-wallet-settlement';
import { VendorCashService } from './vendor-cash.service';
import { vendorWalletSettlementView } from '../../database/entities/vendor-wallet-settlement-view';

/**
 * Olib ketilgandan keyin yetkazish bekor qilinsa — hamyon o'tkazmasi teskari
 * qilinadi (docs/LEGAL-COMPLIANCE.md §14): kuryerga qaytariladi, sotuvchidan
 * tovar summasi yechiladi, komissiya sotuvchiga qaytariladi. Bir martalik;
 * yetkazilgan buyurtmaga tegilmaydi; qayta o'tkazma yangi belgilar bilan.
 *
 * Tovar 145 000, jami 152 000, komissiya 10% → 15 200.
 */
function harness(initial: Record<string, unknown> = {}) {
  let order: Record<string, unknown> = {
    id: 'fo-1',
    status: 'ready',
    deliveryOrderId: 'ride-1',
    vendorWalletSettledAt: null,
    vendorWalletReversalCount: 0,
    vendorCashPaidAt: null,
    vendorCashConfirmedAt: null,
    ...initial,
  };
  const ledger: Array<Partial<Transaction>> = [];
  const courierBalance = () =>
    ledger
      .filter((row) => row.userId === 'courier-1')
      .reduce((sum, row) => sum + (row.type === TransactionType.CREDIT ? 1 : -1) * Number(row.amount), 300000);

  const manager = {
    query: jest.fn(async () => []),
    findOne: jest.fn(async () => ({ ...order })),
    update: jest.fn(async (entity: unknown, criteria: Record<string, unknown>, changes: Record<string, unknown>) => {
      expect(entity).toBe(FoodOrder);
      // Olib ketish: `vendorWalletSettledAt IS NULL`; teskari: hisoblagich + belgi bor.
      const settleClaim = 'vendorWalletSettledAt' in criteria && !('vendorWalletReversalCount' in criteria);
      if (settleClaim) {
        if (order.vendorWalletSettledAt) return { affected: 0 };
      } else if (!order.vendorWalletSettledAt || order.vendorWalletReversalCount !== criteria.vendorWalletReversalCount) {
        return { affected: 0 };
      }
      order = { ...order, ...changes };
      return { affected: 1 };
    }),
    getRepository: jest.fn(() => ({
      createQueryBuilder: () => {
        const qb = {
          select: () => qb,
          where: () => qb,
          getRawOne: async () => ({ balance: String(courierBalance()) }),
        };
        return qb;
      },
      find: jest.fn(async ({ where }: { where: { externalId: { _value: string[] } } }) =>
        ledger.filter((row) => where.externalId._value.includes(row.externalId as string)),
      ),
      save: jest.fn(async (row: Partial<Transaction>) => {
        if (ledger.some((existing) => existing.externalId === row.externalId)) {
          throw new Error('duplicate key value violates unique constraint "uq_transactions_vendor_settlement"');
        }
        ledger.push(row);
        return row;
      }),
    })),
  };

  const settle = (round: number) =>
    settleVendorViaWallet(manager as never, {
      kind: 'food',
      vendorOrderId: 'fo-1',
      vendorOrderTotalPrice: 152000,
      vendorCommissionRate: 10,
      vendorOwnerUserId: 'owner-1',
      courierUserId: 'courier-1',
      amount: 145000,
      existingPaidAt: null,
      round,
    });
  const reverse = (deliveryOrderId = 'ride-1') =>
    reverseVendorWalletSettlement(manager as never, { kind: 'food', vendorOrderId: 'fo-1', deliveryOrderId });

  return { manager, ledger, settle, reverse, order: () => order, courierBalance };
}

describe('reverseVendorWalletSettlement', () => {
  it('uchta qatorni teskari qiladi va buyurtma belgisini tozalaydi', async () => {
    const h = harness();
    await h.settle(1);
    expect(h.courierBalance()).toBe(155000);

    const result = await h.reverse();
    expect(result).toEqual(
      expect.objectContaining({ reversed: true, courierUserId: 'courier-1', amount: 145000, commission: 15200 }),
    );
    expect(h.ledger.slice(3)).toEqual([
      expect.objectContaining({
        userId: 'courier-1',
        type: TransactionType.CREDIT,
        amount: 145000,
        status: TransactionStatus.COMPLETED,
        externalId: 'vendor_settlement_reversal_debit_fo-1',
      }),
      expect.objectContaining({
        userId: 'owner-1',
        type: TransactionType.DEBIT,
        amount: 145000,
        externalId: 'vendor_settlement_reversal_credit_fo-1',
      }),
      expect.objectContaining({
        userId: 'owner-1',
        type: TransactionType.CREDIT,
        amount: 15200,
        externalId: 'vendor_settlement_reversal_commission_fo-1',
      }),
    ]);
    expect(h.courierBalance()).toBe(300000);
    expect(h.order()).toEqual(
      expect.objectContaining({
        vendorWalletSettledAt: null,
        vendorCashPaidAt: null,
        vendorCashConfirmedAt: null,
        vendorWalletReversalCount: 1,
      }),
    );
  });

  it('takror chaqiruv — hech narsa yozilmaydi', async () => {
    const h = harness();
    await h.settle(1);
    await h.reverse();
    expect((await h.reverse()).reversed).toBe(false);
    expect(h.ledger).toHaveLength(6);
  });

  it('yetkazilgan buyurtma teskari qilinmaydi', async () => {
    const h = harness();
    await h.settle(1);
    await h.manager.update(FoodOrder, { vendorWalletReversalCount: 0 }, { status: 'delivered' });
    expect(await h.reverse()).toEqual(expect.objectContaining({ reversed: false, reason: 'delivered' }));
    expect(h.ledger).toHaveLength(3);
  });

  it("eski (almashtirilgan) safarning bekor qilinishi — tegilmaydi", async () => {
    const h = harness();
    await h.settle(1);
    expect(await h.reverse('old-ride')).toEqual(expect.objectContaining({ reversed: false, reason: 'stale_ride' }));
  });

  it("o'tkazma bo'lmagan buyurtma — no-op", async () => {
    const h = harness();
    expect(await h.reverse()).toEqual(expect.objectContaining({ reversed: false, reason: 'not_settled' }));
  });

  it("teskaridan keyin yangi kuryer qayta o'tkazadi — 2-raund belgilari bilan", async () => {
    const h = harness();
    await h.settle(1);
    await h.reverse();
    await h.settle(2);
    expect(h.ledger.slice(6).map((row) => row.externalId)).toEqual([
      VENDOR_SETTLEMENT_TAG.courierDebit('fo-1', 2),
      VENDOR_SETTLEMENT_TAG.vendorCredit('fo-1', 2),
      VENDOR_SETTLEMENT_TAG.vendorCommission('fo-1', 2),
    ]);
    expect(VENDOR_SETTLEMENT_TAG.courierDebit('fo-1', 2)).toBe('vendor_settlement_debit_fo-1_2');
    // va u ham teskari qilinadi
    expect((await h.reverse()).reversed).toBe(true);
    expect(h.ledger.at(-1)?.externalId).toBe('vendor_settlement_reversal_commission_fo-1_2');
  });
});

describe('VendorCashService.filterCouriersByWallet', () => {
  function build(mode: 'cash' | 'wallet', balances: Record<string, number>) {
    const dataSource = {
      manager: {
        query: jest.fn(async () =>
          Object.entries(balances).map(([user_id, balance]) => ({ user_id, balance: String(balance) })),
        ),
      },
    };
    return new VendorCashService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { emitToUser: jest.fn() } as never,
      { getEffectiveVendorSettlementMode: jest.fn(async () => mode) } as never,
      dataSource as never,
    );
  }
  const c = (userId: string) => ({ userId, driverId: `d-${userId}`, distanceKm: 1, lat: 0, lng: 0 });

  it('hamyon rejimida tovar summasidan kam (yoki manfiy) balansli kuryerlar chiqariladi', async () => {
    const service = build('wallet', { a: 200000, b: 100000, c: -5000 });
    const result = await service.filterCouriersByWallet(145000, [c('a'), c('b'), c('c'), c('d')]);
    expect(result.map((x) => x.userId)).toEqual(['a']);
  });

  it('naqd rejimda filtr yo\'q', async () => {
    const service = build('cash', {});
    expect(await service.filterCouriersByWallet(145000, [c('a'), c('b')])).toHaveLength(2);
  });
});

/**
 * Kuryer QAYTA BIRIKTIRILSA (dispatch override) va oldingi kuryer sotuvchiga
 * hamyondan to'lab bo'lgan bo'lsa — uning o'tkazmasi bekor qilishdagi bilan
 * bir xil mexanizmda teskari qilinadi, yangi kuryer `_2` belgilari bilan
 * qayta o'tkazadi (docs/LEGAL-COMPLIANCE.md §19).
 */
describe('kuryer qayta biriktirilganda hamyon o\'tkazmasi', () => {
  it("oldingi kuryer o'tkazmasi teskari, keyingi kuryer yangidan o'tkazadi", async () => {
    const h = harness();
    await h.settle(1);
    const result = await reverseVendorWalletSettlement(h.manager as never, {
      kind: 'food',
      vendorOrderId: 'fo-1',
      deliveryOrderId: 'ride-1',
      courierUserId: 'courier-1',
    });
    expect(result).toEqual(expect.objectContaining({ reversed: true, courierUserId: 'courier-1', amount: 145000 }));
    expect(h.courierBalance()).toBe(300000);
    expect(h.order()).toEqual(expect.objectContaining({ vendorWalletSettledAt: null, vendorWalletReversalCount: 1 }));

    // Yangi kuryer — 2-raund belgilari (unikal indeks to'qnashmaydi).
    await h.settle(2);
    expect(h.ledger.at(-3)?.externalId).toBe('vendor_settlement_debit_fo-1_2');
  });

  it("o'tkazmani boshqa kuryer qilgan bo'lsa — tegilmaydi (other_courier)", async () => {
    const h = harness();
    await h.settle(1);
    const result = await reverseVendorWalletSettlement(h.manager as never, {
      kind: 'food',
      vendorOrderId: 'fo-1',
      deliveryOrderId: 'ride-1',
      courierUserId: 'someone-else',
    });
    expect(result).toEqual({ reversed: false, reason: 'other_courier' });
    expect(h.ledger).toHaveLength(3);
  });

  it("takroriy 'reassigned' hodisasi — ikkinchi marta yozilmaydi", async () => {
    const h = harness();
    await h.settle(1);
    const input = { kind: 'food' as const, vendorOrderId: 'fo-1', deliveryOrderId: 'ride-1', courierUserId: 'courier-1' };
    await reverseVendorWalletSettlement(h.manager as never, input);
    expect((await reverseVendorWalletSettlement(h.manager as never, input)).reversed).toBe(false);
    expect(h.ledger).toHaveLength(6);
  });

  it("VendorCashService 'reassigned' hodisasida oldingi kuryer bilan teskari qiladi", async () => {
    let listener: ((event: unknown) => Promise<void>) | undefined;
    const deliveryEvents = { subscribe: jest.fn((fn: (event: unknown) => Promise<void>) => (listener = fn)) };
    const service = new VendorCashService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { emitToUser: jest.fn() } as never,
      undefined,
      {} as never,
      deliveryEvents as never,
    );
    const reverse = jest
      .spyOn(service, 'reverseWalletSettlement')
      .mockResolvedValue({ reversed: true, courierUserId: 'courier-1' });
    service.onModuleInit();

    await listener?.({
      kind: 'reassigned',
      deliveryOrderId: 'ride-1',
      foodOrderId: 'fo-1',
      marketOrderId: null,
      previousCourierUserId: 'courier-1',
    });
    expect(reverse).toHaveBeenCalledWith('food', 'fo-1', 'ride-1', 'courier-1');

    reverse.mockClear();
    await listener?.({ kind: 'accepted', deliveryOrderId: 'ride-1', foodOrderId: 'fo-1', marketOrderId: null });
    expect(reverse).not.toHaveBeenCalled();
  });
});

/**
 * `vendorWalletSettlement` (§22): summalar O'TKAZMA PAYTIDA saqlanadi —
 * keyin komissiya stavkasi o'zgarsa ham buyurtma JSON'i o'sha raqamni
 * ko'rsatadi; teskari o'tkazma ham ko'rinadi.
 */
describe("hamyon o'tkazmasi summalari buyurtmada saqlanadi", () => {
  it("o'tkazmada amount/commission yoziladi, teskarisida reversedAt", async () => {
    const h = harness();
    await h.settle(1);
    expect(h.order()).toEqual(
      expect.objectContaining({
        vendorWalletAmount: 145000,
        vendorWalletCommission: 15200,
        vendorWalletSettledAt: expect.any(Date),
      }),
    );

    await h.reverse();
    expect(h.order()).toEqual(
      expect.objectContaining({
        vendorWalletAmount: 145000,
        vendorWalletCommission: 15200,
        vendorWalletSettledAt: null,
        vendorWalletReversedAt: expect.any(Date),
        vendorWalletReversalCount: 1,
      }),
    );
  });
});

describe('vendorWalletSettlementView', () => {
  it("hech qachon o'tkazilmagan — null", () => {
    expect(vendorWalletSettlementView({ vendorWalletAmount: null } as never)).toBeNull();
  });

  it('o‘tkazilgan va teskari qilingan holat', () => {
    const settledAt = new Date('2026-12-13T10:00:00Z');
    const reversedAt = new Date('2026-12-13T10:30:00Z');
    expect(
      vendorWalletSettlementView({
        vendorWalletAmount: '145000.00',
        vendorWalletCommission: '15200.00',
        vendorWalletSettledAt: settledAt,
        vendorWalletReversedAt: reversedAt,
        vendorWalletReversalCount: 1,
      } as never),
    ).toEqual({
      amount: 145000,
      commission: 15200,
      net: 129800,
      settledAt: settledAt.toISOString(),
      reversedAt: reversedAt.toISOString(),
      reversalCount: 1,
    });
  });
});

/**
 * Security review #3b / #9 — qulf tartibi. O'tkazma ham, teskari o'tkazma ham:
 *   1) hamyon advisory qulflari — kuryer VA sotuvchi, id bo'yicha SARALANGAN;
 *   2) keyin buyurtma qatori.
 * Ilgari teskari o'tkazma avval qator (`FOR UPDATE`), keyin advisory
 * qulfni olardi (o'tkazma — teskarisi) va sotuvchi hamyonini umuman
 * qulflamasdi: sotuvchi yechish bilan parallel manfiyga tushishi mumkin edi.
 */
describe('vendor wallet lock order (#3b, #9)', () => {
  type Event = { kind: 'advisory'; key: string } | { kind: 'row' };

  function events(manager: { query: jest.Mock; findOne: jest.Mock; update: jest.Mock }): Event[] {
    const out: Array<{ order: number; event: Event }> = [];
    manager.query.mock.calls.forEach((call: unknown[], i: number) => {
      if (String(call[0]).includes('pg_advisory_xact_lock')) {
        out.push({ order: manager.query.mock.invocationCallOrder[i], event: { kind: 'advisory', key: String((call[1] as string[])[0]) } });
      }
    });
    manager.findOne.mock.calls.forEach((call: unknown[], i: number) => {
      const options = call[1] as { lock?: unknown } | undefined;
      if (options?.lock) out.push({ order: manager.findOne.mock.invocationCallOrder[i], event: { kind: 'row' } });
    });
    manager.update.mock.calls.forEach((_call: unknown[], i: number) => {
      out.push({ order: manager.update.mock.invocationCallOrder[i], event: { kind: 'row' } });
    });
    return out.sort((a, b) => a.order - b.order).map((entry) => entry.event);
  }

  it("o'tkazma: ikkala hamyon saralangan tartibda, keyin buyurtma qatori", async () => {
    const h = harness();
    await h.settle(1);
    const seq = events(h.manager as never);
    expect(seq.slice(0, 3)).toEqual([
      { kind: 'advisory', key: 'courier-1' },
      { kind: 'advisory', key: 'owner-1' },
      { kind: 'row' },
    ]);
  });

  it('teskari: kuryer va SOTUVCHI hamyoni qulflanadi, buyurtma qatoridan OLDIN', async () => {
    const h = harness();
    await h.settle(1);
    h.manager.query.mockClear();
    h.manager.findOne.mockClear();
    h.manager.update.mockClear();

    const result = await h.reverse();
    expect(result.reversed).toBe(true);
    const seq = events(h.manager as never);
    const firstRow = seq.findIndex((e) => e.kind === 'row');
    expect(seq.slice(0, firstRow)).toEqual([
      { kind: 'advisory', key: 'courier-1' },
      { kind: 'advisory', key: 'owner-1' },
    ]);
  });
});
