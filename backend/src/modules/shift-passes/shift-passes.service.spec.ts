import { BadRequestException, ConflictException } from '@nestjs/common';
import { ShiftPassesService } from './shift-passes.service';
import {
  DriverShiftPass,
  DriverShiftPassStatus,
} from '../../database/entities/driver-shift-pass.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { PaymentMethod } from '../../database/entities/order.entity';

/**
 * Smena sotib olish va qamrovi. Repozitoriylar xotiradagi soxta — so'rov
 * shakli emas, natija tekshiriladi.
 */
describe('ShiftPassesService', () => {
  const DRIVER = 'driver-user-1';
  const NOW = new Date('2026-10-15T06:00:00Z');

  let passes: DriverShiftPass[];
  let ledger: Array<Partial<Transaction>>;
  let walletBalance: number;
  let settings: { shiftPassEnabled: boolean; shiftPassPrice: number; shiftPassDurationHours: number; shiftPassServiceTypes: string[] };
  let adjustBalanceWithin: jest.Mock;
  let takeOfflineInRedis: jest.Mock;
  let recordForShiftPass: jest.Mock;
  let rawQuery: jest.Mock;
  let service: ShiftPassesService;

  const passRepo = () => ({
    find: jest.fn(async ({ where }: { where: { driverId?: string } }) =>
      passes.filter((p) => !where?.driverId || p.driverId === where.driverId),
    ),
    findOne: jest.fn(async ({ where }: { where: { id: string } }) => passes.find((p) => p.id === where.id) ?? null),
    save: jest.fn(async (value: DriverShiftPass) => {
      passes.push({ ...value, createdAt: NOW });
      return value;
    }),
    update: jest.fn(async () => ({ affected: 0 })),
    query: rawQuery,
  });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    passes = [];
    ledger = [];
    walletBalance = 40000;
    settings = { shiftPassEnabled: true, shiftPassPrice: 25000, shiftPassDurationHours: 24, shiftPassServiceTypes: ['taxi'] };
    adjustBalanceWithin = jest.fn().mockResolvedValue({ driverId: 'd1', newBalance: 0, wentOffline: false });
    takeOfflineInRedis = jest.fn();
    recordForShiftPass = jest.fn().mockResolvedValue(null);
    rawQuery = jest.fn().mockResolvedValue([{ commission: '0', working_days: '0' }]);

    const repo = passRepo();
    const manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('pg_advisory_xact_lock')) return [];
        throw new Error(`unexpected sql ${sql}`);
      }),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === DriverShiftPass) return repo;
        if (entity === Transaction) {
          return {
            createQueryBuilder: () => {
              const qb = {
                select: () => qb,
                where: () => qb,
                getRawOne: async () => ({ balance: String(walletBalance) }),
              };
              return qb;
            },
            save: jest.fn(async (row: Partial<Transaction>) => {
              const saved = { id: `tx-${ledger.length + 1}`, ...row };
              ledger.push(saved);
              return saved;
            }),
          };
        }
        throw new Error('unexpected repository');
      }),
    };

    service = new ShiftPassesService(
      repo as never,
      { getShiftPassSettings: jest.fn(async () => settings) } as never,
      { adjustBalanceWithin, takeOfflineInRedis } as never,
      { transaction: (cb: (m: unknown) => Promise<unknown>) => cb(manager) } as never,
      { recordForShiftPass } as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  describe('buy', () => {
    it('hamyondan yechadi, 24 soatlik smena yaratadi, fiskal yozuv qo‘yadi', async () => {
      const pass = await service.buy(DRIVER);

      expect(pass).toMatchObject({
        driverId: DRIVER,
        startsAt: NOW.toISOString(),
        endsAt: '2026-10-16T06:00:00.000Z',
        price: 25000,
        status: 'active',
        serviceTypes: ['taxi'],
      });
      expect(ledger).toEqual([
        expect.objectContaining({
          userId: DRIVER,
          orderId: null,
          amount: 25000,
          type: TransactionType.DEBIT,
          paymentMethod: PaymentMethod.WALLET,
          status: TransactionStatus.COMPLETED,
          externalId: `shift_pass_${pass.id}`,
        }),
      ]);
      expect(passes[0].transactionId).toBe(ledger[0].id);
      expect(adjustBalanceWithin).toHaveBeenCalledWith(expect.anything(), DRIVER, -25000);
      expect(recordForShiftPass).toHaveBeenCalledWith({ passId: pass.id, driverUserId: DRIVER, price: 25000 });
    });

    it('balans yetmasa — o‘zbekcha 400, hech narsa yozilmaydi', async () => {
      walletBalance = 10000;
      await expect(service.buy(DRIVER)).rejects.toThrow(/Hamyonda mablag' yetarli emas/);
      expect(ledger).toHaveLength(0);
      expect(passes).toHaveLength(0);
    });

    it('faol smena bor — 409 (ustma-ust tushmaydi)', async () => {
      await service.buy(DRIVER);
      await expect(service.buy(DRIVER)).rejects.toBeInstanceOf(ConflictException);
      expect(ledger).toHaveLength(1);
    });

    it('muddati o‘tgan smenadan keyin yangisini olish mumkin', async () => {
      await service.buy(DRIVER);
      jest.setSystemTime(new Date('2026-10-16T06:00:00Z'));
      await expect(service.buy(DRIVER)).resolves.toMatchObject({ status: 'active' });
    });

    it('o‘chiq — 400', async () => {
      settings.shiftPassEnabled = false;
      await expect(service.buy(DRIVER)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('fiskal yozuv xatosi sotib olishni buzmaydi', async () => {
      recordForShiftPass.mockRejectedValue(new Error('down'));
      await expect(service.buy(DRIVER)).resolves.toMatchObject({ status: 'active' });
    });

    it('balans manfiyga tushib oflayn bo‘lsa — Redis’dan ham chiqariladi', async () => {
      adjustBalanceWithin.mockResolvedValue({ driverId: 'd1', newBalance: -1, wentOffline: true });
      await service.buy(DRIVER);
      expect(takeOfflineInRedis).toHaveBeenCalledWith('d1', expect.any(String));
    });
  });

  describe('hasActivePassFor', () => {
    beforeEach(async () => {
      await service.buy(DRIVER);
    });

    it('smena oynasi va xizmat turi mos — true', async () => {
      await expect(service.hasActivePassFor(DRIVER, 'taxi', new Date('2026-10-15T20:00:00Z'))).resolves.toBe(true);
    });

    it('boshqa xizmat yoki oynadan tashqari — false', async () => {
      await expect(service.hasActivePassFor(DRIVER, 'food', new Date('2026-10-15T20:00:00Z'))).resolves.toBe(false);
      await expect(service.hasActivePassFor(DRIVER, 'taxi', new Date('2026-10-16T06:00:00Z'))).resolves.toBe(false);
      await expect(service.hasActivePassFor('other', 'taxi', new Date('2026-10-15T20:00:00Z'))).resolves.toBe(false);
    });

    it('bekor qilingan — false', async () => {
      passes[0].status = DriverShiftPassStatus.CANCELLED;
      await expect(service.hasActivePassFor(DRIVER, 'taxi', new Date('2026-10-15T20:00:00Z'))).resolves.toBe(false);
    });
  });

  describe('getMine', () => {
    it('joriy smena, sozlamalar va taqqoslash', async () => {
      rawQuery.mockResolvedValue([{ commission: '120000', working_days: '4' }]);
      await service.buy(DRIVER);

      const mine = await service.getMine(DRIVER);
      expect(mine).toMatchObject({
        enabled: true,
        price: 25000,
        durationHours: 24,
        serviceTypes: ['taxi'],
        current: { status: 'active', endsAt: '2026-10-16T06:00:00.000Z' },
        comparison: { periodDays: 7, commissionPaid: 120000, workingDays: 4, passCost: 100000, cheaperOption: 'shift_pass', savings: 20000 },
      });
    });

    it('smena yo‘q — current null', async () => {
      await expect(service.getMine(DRIVER)).resolves.toMatchObject({ current: null });
    });
  });
});

describe('ShiftPassesService.listForAdmin', () => {
  it('davr bo‘yicha ro‘yxat va jami (bekor qilinganlar daromadga kirmaydi)', async () => {
    const NOW = new Date('2026-10-15T12:00:00Z');
    const rows = [
      {
        id: 'p1', driverId: 'u1', startsAt: new Date('2026-10-15T06:00:00Z'), endsAt: new Date('2026-10-16T06:00:00Z'),
        price: 25000, status: 'active', serviceTypes: ['taxi'], transactionId: 't1', createdAt: new Date('2026-10-15T06:00:00Z'),
        driver: { phone: '+998901112233', firstName: 'Ali', lastName: 'Valiyev' },
      },
      {
        id: 'p2', driverId: 'u2', startsAt: new Date('2026-10-10T06:00:00Z'), endsAt: new Date('2026-10-11T06:00:00Z'),
        price: 25000, status: 'active', serviceTypes: ['taxi'], transactionId: 't2', createdAt: new Date('2026-10-10T06:00:00Z'),
        driver: { phone: '+998901112244', firstName: null, lastName: null },
      },
    ];
    const findAndCount = jest.fn().mockResolvedValue([rows, 3]);
    const query = jest.fn().mockResolvedValue([{ count: '3', revenue: '50000', cancelled: '1', active_now: '1' }]);
    const service = new ShiftPassesService(
      { findAndCount, query } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.listForAdmin(
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-31T00:00:00Z'),
      { now: NOW },
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM driver_shift_passes'), [
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-31T00:00:00Z'),
      NOW,
    ]);
    // Standart: 1-sahifa, 500 qator (avvalgi chegara) — eski mijozlar o'zgarishsiz.
    expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 500 }));
    expect(result).toEqual({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T00:00:00.000Z',
      total: 3,
      page: 1,
      limit: 500,
      totals: { count: 3, revenue: 50000, cancelled: 1, activeNow: 1 },
      items: [
        expect.objectContaining({ id: 'p1', status: 'active', driverPhone: '+998901112233', driverName: 'Ali Valiyev' }),
        expect.objectContaining({ id: 'p2', status: 'expired', driverPhone: '+998901112244', driverName: null }),
      ],
    });
  });
});

describe('ShiftPassesService.listForAdmin — sahifalash', () => {
  it('page/limit → skip/take; activeNow butun oraliq bo‘yicha (SQL)', async () => {
    const findAndCount = jest.fn().mockResolvedValue([[], 120]);
    const query = jest.fn().mockResolvedValue([{ count: '120', revenue: '0', cancelled: '0', active_now: '7' }]);
    const service = new ShiftPassesService({ findAndCount, query } as never, {} as never, {} as never, {} as never);

    const result = await service.listForAdmin(new Date('2026-10-01T00:00:00Z'), new Date('2026-10-31T00:00:00Z'), {
      page: 3,
      limit: 50,
    });

    expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 100, take: 50 }));
    expect(result).toEqual(expect.objectContaining({ total: 120, page: 3, limit: 50 }));
    expect(result.totals.activeNow).toBe(7);
  });
});

describe('ShiftPassesService.totalCostSince', () => {
  it('bekor qilinmagan smenalar yig‘indisi', async () => {
    const query = jest.fn().mockResolvedValue([{ total: '50000.00' }]);
    const service = new ShiftPassesService({ query } as never, {} as never, {} as never, {} as never);
    const from = new Date('2026-10-08T00:00:00Z');
    await expect(service.totalCostSince('u1', from)).resolves.toBe(50000);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("status <> 'cancelled'"), ['u1', from]);
  });
});
