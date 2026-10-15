import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddFundsDto } from './dto/add-funds.dto';
import { DriverWalletAdjustmentsService } from './driver-wallet-adjustments.service';
import { TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { AUDIT_ACTIONS } from '../audit/audit-log.service';

/**
 * Qo'lda to'ldirish/tuzatish (`PATCH /drivers/:id/balance`) —
 * docs/LEGAL-COMPLIANCE.md §12: izoh majburiy, jurnal yozuvi pul harakati
 * bilan bitta tranzaksiyada, haydovchiga push.
 */
describe('DriverWalletAdjustmentsService', () => {
  const driver = { id: 'driver-1', userId: 'user-1', isOnline: true };

  function build(syncResult = { driverId: 'driver-1', newBalance: 60000, wentOffline: false }) {
    const saved: Array<Record<string, unknown>> = [];
    const order: string[] = [];
    const manager = {
      query: jest.fn(async () => {
        order.push('lock');
        return [];
      }),
      getRepository: jest.fn(() => ({
        save: jest.fn(async (row: Record<string, unknown>) => {
          order.push('ledger');
          saved.push(row);
          return { id: 'tx-1', ...row };
        }),
      })),
    };
    const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
    const driversService = {
      findByIdOrThrow: jest.fn(async () => driver),
      adjustBalanceWithin: jest.fn(async () => {
        order.push('sync');
        return syncResult;
      }),
      takeOfflineInRedis: jest.fn(),
    };
    const auditLog = {
      record: jest.fn(async (entry: Record<string, unknown>, m: unknown) => {
        order.push('audit');
        expect(m).toBe(manager);
        return { id: 'audit-1', ...entry };
      }),
    };
    const notifier = { balanceChanged: jest.fn() };
    const service = new DriverWalletAdjustmentsService(
      dataSource as never,
      driversService as never,
      auditLog as never,
      notifier as never,
    );
    return { service, saved, order, driversService, auditLog, notifier };
  }

  it("to'ldirish: jurnal + daftar + ustun sinxroni bitta tranzaksiyada, push matnida izoh", async () => {
    const ctx = build();
    const result = await ctx.service.adjust('admin-1', 'driver-1', 50000, '  Naqd kassaga topshirdi ');

    expect(ctx.order).toEqual(['lock', 'audit', 'ledger', 'sync']);
    expect(ctx.auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: AUDIT_ACTIONS.walletManualAdjustment,
        targetType: 'driver',
        targetId: 'driver-1',
        amount: 50000,
        note: 'Naqd kassaga topshirdi',
      }),
      expect.anything(),
    );
    expect(ctx.saved[0]).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        amount: 50000,
        type: TransactionType.CREDIT,
        status: TransactionStatus.COMPLETED,
        // Izoh endi `external_id` ga yozilmaydi ('commission' kabi belgilar
        // bilan to'qnashishi mumkin edi) — jurnal yozuviga havola.
        externalId: 'manual_adjustment_audit-1',
      }),
    );
    expect(ctx.notifier.balanceChanged).toHaveBeenCalledWith('user-1', {
      delta: 50000,
      reason: 'manual_adjustment',
      push: expect.objectContaining({
        body: "Hamyoningizga 50 000 so'm qo'shildi: Naqd kassaga topshirdi",
      }),
      extra: { auditLogId: 'audit-1' },
    });
    expect(result).toEqual(expect.objectContaining({ id: 'driver-1', walletBalance: 60000 }));
  });

  it('tuzatish (manfiy): DEBIT, tuzatish matni, manfiyga tushsa Redis\'dan chiqariladi', async () => {
    const ctx = build({ driverId: 'driver-1', newBalance: -5000, wentOffline: true });
    await ctx.service.adjust('admin-1', 'driver-1', -15000, 'Ikki marta yozilgan');
    expect(ctx.saved[0]).toEqual(
      expect.objectContaining({ amount: 15000, type: TransactionType.DEBIT }),
    );
    expect(ctx.driversService.takeOfflineInRedis).toHaveBeenCalledWith('driver-1', expect.any(String));
    const notice = ctx.notifier.balanceChanged.mock.calls[0][1];
    expect(notice.delta).toBe(-15000);
    expect(notice.push.body).toBe("Hamyoningizdan 15 000 so'm yechildi (tuzatish): Ikki marta yozilgan");
  });

  it("izohsiz — 400 va hech narsa yozilmaydi", async () => {
    const ctx = build();
    await expect(ctx.service.adjust('admin-1', 'driver-1', 1000, '   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(ctx.saved).toHaveLength(0);
    expect(ctx.auditLog.record).not.toHaveBeenCalled();
  });
});

/**
 * Security review #6 — qo'lda tuzatish chegaralari: butun so'm,
 * |summa| ≤ 5 000 000; menejer (admin emas) ≤ `manualAdjustmentManagerLimit`
 * (standart 2 000 000), oshsa — 403 MANUAL_ADJUSTMENT_LIMIT.
 */
describe('Manual adjustment bounds (#6)', () => {
  const errorsFor = async (amount: unknown) =>
    (await validate(plainToInstance(AddFundsDto, { amount, note: 'Tuzatish' }))).filter((e) => e.property === 'amount');

  it.each([[5_000_001], [-5_000_001], [100.5], [0]])('DTO rad etadi: %p', async (amount) => {
    expect(await errorsFor(amount)).not.toHaveLength(0);
  });

  it.each([[5_000_000], [-5_000_000], [1]])('DTO o‘tkazadi: %p', async (amount) => {
    expect(await errorsFor(amount)).toHaveLength(0);
  });

  function build(limit = 2_000_000) {
    const manager = { query: jest.fn(async () => []), getRepository: jest.fn(() => ({ save: jest.fn(async (r: unknown) => r) })) };
    const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
    const driversService = {
      findByIdOrThrow: jest.fn(async () => ({ id: 'driver-1', userId: 'user-1' })),
      adjustBalanceWithin: jest.fn(async () => ({ driverId: 'driver-1', newBalance: 1, wentOffline: false })),
      takeOfflineInRedis: jest.fn(),
    };
    const auditLog = { record: jest.fn(async (entry: Record<string, unknown>) => ({ id: 'audit-1', ...entry })) };
    const settings = { getWalletTopupSettings: jest.fn(async () => ({ manualAdjustmentManagerLimit: limit })) };
    const service = new DriverWalletAdjustmentsService(
      dataSource as never,
      driversService as never,
      auditLog as never,
      { balanceChanged: jest.fn() } as never,
      settings as never,
    );
    return { service, dataSource };
  }

  it('menejer chegaradan oshsa — 403 MANUAL_ADJUSTMENT_LIMIT, pul yozilmaydi', async () => {
    const { service, dataSource } = build();
    const err = await service
      .adjust('manager-1', 'driver-1', 2_000_001, 'Katta tuzatish', 'manager' as never)
      .catch((e: unknown) => e);
    expect((err as { getStatus(): number }).getStatus()).toBe(403);
    expect((err as { getResponse(): unknown }).getResponse()).toMatchObject({
      code: 'MANUAL_ADJUSTMENT_LIMIT',
      details: { limit: 2_000_000 },
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
    // Manfiy tuzatish ham |summa| bo'yicha.
    await expect(
      service.adjust('manager-1', 'driver-1', -2_000_001, 'Katta', 'manager' as never),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('menejer chegara ichida va admin 5 000 000 gacha — o‘tadi', async () => {
    const { service } = build();
    await expect(service.adjust('manager-1', 'driver-1', 2_000_000, 'OK', 'manager' as never)).resolves.toBeDefined();
    await expect(service.adjust('admin-1', 'driver-1', 5_000_000, 'OK', 'admin' as never)).resolves.toBeDefined();
  });

  it('servis darajasida ham: kasr yoki 5 000 000 dan katta — 400', async () => {
    const { service } = build();
    await expect(service.adjust('admin-1', 'driver-1', 100.5, 'x', 'admin' as never)).rejects.toMatchObject({ status: 400 });
    await expect(service.adjust('admin-1', 'driver-1', 5_000_001, 'x', 'admin' as never)).rejects.toMatchObject({ status: 400 });
  });
});
