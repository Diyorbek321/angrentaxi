import { ConflictException, NotFoundException } from '@nestjs/common';
import { ShiftPassesService } from './shift-passes.service';
import { shiftPassProRataRefund } from './shift-pass-policy';
import {
  DriverShiftPass,
  DriverShiftPassStatus,
} from '../../database/entities/driver-shift-pass.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { AUDIT_ACTIONS } from '../audit/audit-log.service';

/**
 * Admin smenani bekor qiladi (docs/LEGAL-COMPLIANCE.md §15):
 * `POST /admin/shift-passes/:id/cancel { refund, reason }`.
 * Qaytarim pro-rata: `floor(narx × qolgan vaqt / davomiylik)`.
 */
describe('shiftPassProRataRefund', () => {
  const pass = {
    startsAt: new Date('2026-10-15T06:00:00Z'),
    endsAt: new Date('2026-10-16T06:00:00Z'),
    price: 25000,
  };

  it('yarmi o\'tganda — yarmi', () => {
    expect(shiftPassProRataRefund(pass, new Date('2026-10-15T18:00:00Z'))).toBe(12500);
  });
  it("hali boshlanmagan — to'liq; tugagan — 0", () => {
    expect(shiftPassProRataRefund(pass, new Date('2026-10-15T05:00:00Z'))).toBe(25000);
    expect(shiftPassProRataRefund(pass, new Date('2026-10-16T07:00:00Z'))).toBe(0);
  });
  it("kasr so'm pastga yaxlitlanadi (ortiqcha qaytarilmaydi)", () => {
    // 1/3 qolgan: 25000 / 3 = 8333.33 → 8333
    expect(shiftPassProRataRefund(pass, new Date('2026-10-15T22:00:00Z'))).toBe(8333);
  });
});

describe('ShiftPassesService.cancel', () => {
  const NOW = new Date('2026-10-15T18:00:00Z');
  let passes: DriverShiftPass[];
  let ledger: Array<Partial<Transaction>>;
  let adjustBalanceWithin: jest.Mock;
  let auditRecord: jest.Mock;
  let notifier: { balanceChanged: jest.Mock };
  let fiscalReceipts: { recordShiftPassRefund: jest.Mock; recordForShiftPass: jest.Mock };
  let service: ShiftPassesService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    passes = [
      {
        id: 'pass-1',
        driverId: 'driver-user-1',
        startsAt: new Date('2026-10-15T06:00:00Z'),
        endsAt: new Date('2026-10-16T06:00:00Z'),
        price: 25000,
        status: DriverShiftPassStatus.ACTIVE,
        serviceTypes: ['taxi'],
        transactionId: 'tx-0',
        createdAt: new Date('2026-10-15T06:00:00Z'),
        cancelledAt: null,
        cancelReason: null,
        refundAmount: null,
      } as DriverShiftPass,
    ];
    ledger = [];
    adjustBalanceWithin = jest.fn().mockResolvedValue({ driverId: 'd1', newBalance: 12500, wentOffline: false });
    auditRecord = jest.fn(async (entry: Record<string, unknown>) => ({ id: 'audit-1', ...entry }));
    notifier = { balanceChanged: jest.fn() };
    fiscalReceipts = { recordShiftPassRefund: jest.fn(async () => ({ id: 'refund-receipt' })), recordForShiftPass: jest.fn() };

    const passRepo = {
      findOne: jest.fn(async ({ where }: { where: { id: string } }) => passes.find((p) => p.id === where.id) ?? null),
      update: jest.fn(async (criteria: { id: string; status: unknown }, changes: Partial<DriverShiftPass>) => {
        const idx = passes.findIndex((p) => p.id === criteria.id && p.status !== DriverShiftPassStatus.CANCELLED);
        if (idx < 0) return { affected: 0 };
        passes[idx] = { ...passes[idx], ...changes };
        return { affected: 1 };
      }),
    };
    const manager = {
      query: jest.fn(async () => []),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === DriverShiftPass) return passRepo;
        if (entity === Transaction) {
          return {
            save: jest.fn(async (row: Partial<Transaction>) => {
              ledger.push(row);
              return { id: 'tx-r', ...row };
            }),
          };
        }
        throw new Error('unexpected repository');
      }),
    };

    service = new ShiftPassesService(
      passRepo as never,
      {} as never,
      { adjustBalanceWithin, takeOfflineInRedis: jest.fn() } as never,
      { transaction: (cb: (m: unknown) => Promise<unknown>) => cb(manager) } as never,
      fiscalReceipts as never,
      { record: auditRecord } as never,
      notifier as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  it("qaytarim bilan: pro-rata CREDIT, holat cancelled, jurnal, push", async () => {
    const result = await service.cancel('admin-1', 'pass-1', { refund: true, reason: 'Texnik nosozlik' });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'pass-1',
        status: 'cancelled',
        refundAmount: 12500,
        cancelReason: 'Texnik nosozlik',
        cancelledAt: NOW.toISOString(),
      }),
    );
    expect(ledger).toEqual([
      expect.objectContaining({
        userId: 'driver-user-1',
        amount: 12500,
        type: TransactionType.CREDIT,
        status: TransactionStatus.COMPLETED,
        externalId: 'shift_pass_refund_pass-1',
      }),
    ]);
    expect(adjustBalanceWithin).toHaveBeenCalledWith(expect.anything(), 'driver-user-1', 12500);
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: AUDIT_ACTIONS.shiftPassCancel,
        targetType: 'shift_pass',
        targetId: 'pass-1',
        amount: 12500,
        note: 'Texnik nosozlik',
      }),
      expect.anything(),
    );
    expect(notifier.balanceChanged).toHaveBeenCalledWith(
      'driver-user-1',
      expect.objectContaining({ delta: 12500, reason: 'shift_pass_refund' }),
    );
  });

  it("qaytarimsiz: daftarga tegmaydi, lekin jurnalga yoziladi", async () => {
    const result = await service.cancel('admin-1', 'pass-1', { refund: false, reason: 'Qoidabuzarlik' });
    expect(result.refundAmount).toBeNull();
    expect(ledger).toHaveLength(0);
    expect(adjustBalanceWithin).not.toHaveBeenCalled();
    expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({ amount: 0 }), expect.anything());
  });

  it('allaqachon bekor qilingan — 409, ikkinchi qaytarim yo\'q', async () => {
    await service.cancel('admin-1', 'pass-1', { refund: true, reason: 'x' });
    await expect(service.cancel('admin-1', 'pass-1', { refund: true, reason: 'x' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(ledger).toHaveLength(1);
  });

  // §20: qaytarim — platforma daromadining kamayishi; asl smena chekiga
  // bog'langan fiskal QAYTARISH cheki yoziladi.
  it('qaytarim bilan — fiskal qaytarish cheki (summa = qaytarim)', async () => {
    await service.cancel('admin-1', 'pass-1', { refund: true, reason: 'Texnik nosozlik' });
    expect(fiscalReceipts.recordShiftPassRefund).toHaveBeenCalledWith({
      passId: 'pass-1',
      driverUserId: 'driver-user-1',
      refundAmount: 12500,
    });
  });

  it("qaytarimsiz yoki qaytarim 0 — fiskal qaytarish cheki yo'q", async () => {
    await service.cancel('admin-1', 'pass-1', { refund: false, reason: 'x' });
    expect(fiscalReceipts.recordShiftPassRefund).not.toHaveBeenCalled();

    passes = [{ ...passes[0], status: DriverShiftPassStatus.ACTIVE, endsAt: new Date('2026-10-15T07:00:00Z') }];
    await service.cancel('admin-1', 'pass-1', { refund: true, reason: 'tugagan' });
    expect(fiscalReceipts.recordShiftPassRefund).not.toHaveBeenCalled();
  });

  it("fiskal xato bekor qilishni buzmaydi", async () => {
    fiscalReceipts.recordShiftPassRefund.mockRejectedValueOnce(new Error('ofd down'));
    await expect(service.cancel('admin-1', 'pass-1', { refund: true, reason: 'x' })).resolves.toEqual(
      expect.objectContaining({ refundAmount: 12500 }),
    );
  });

  it('topilmasa — 404', async () => {
    await expect(service.cancel('admin-1', 'nope', { refund: false, reason: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
