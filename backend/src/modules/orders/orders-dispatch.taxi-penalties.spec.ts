import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { Transaction, TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { UserRole } from '../../database/entities/user.entity';
import { DEFAULT_SAFETY_POLICY_SETTINGS } from '../settings/safety-policy-settings';
import { OrdersDispatchService } from './orders-dispatch.service';

/** Taksi: kech bekor qilish, kelmaslik, haydovchi bekor qilish signali (INCIDENT-POLICY §5). */
describe('OrdersDispatchService — taksi jarimalari', () => {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

  function build(orderOverrides: Record<string, unknown> = {}, opts: { walletBalance?: number } = {}) {
    const order = {
      id: 'ride-1',
      status: OrderStatus.ACCEPTED,
      serviceType: ServiceType.TAXI,
      intercityTripId: null,
      driverId: 'driver-1',
      passengerId: 'p-1',
      acceptedAt: minutesAgo(5),
      arrivedAt: null,
      ...orderOverrides,
    };
    const saved: Array<Record<string, unknown>> = [];
    const updates: Array<Record<string, unknown>> = [];
    let affected = 1;
    const manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('UPDATE drivers')) return [[{ driver_id: 'dp-1', balance: '0', is_online: true, was_online: true }], 1];
        return [];
      }),
      createQueryBuilder: () => {
        const qb = {
          update: () => qb,
          set: (data: Record<string, unknown>) => {
            updates.push(data);
            return qb;
          },
          where: () => qb,
          andWhere: () => qb,
          execute: async () => ({ affected }),
        };
        return qb;
      },
      getRepository: () => ({
        createQueryBuilder: () => {
          const qb = {
            select: () => qb,
            where: () => qb,
            getRawOne: async () => ({ balance: String(opts.walletBalance ?? 0) }),
          };
          return qb;
        },
      }),
      save: jest.fn(async (_entity: unknown, row: Record<string, unknown>) => {
        saved.push(row);
        return row;
      }),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    const statusTransition = { updateOrderStatusAtomic: jest.fn().mockResolvedValue(undefined) };
    const realtime = { emitToUser: jest.fn(), emitToManagers: jest.fn() };
    const audit = { record: jest.fn(async () => ({ id: 'a-1' })) };
    const signals = { onDriverCancelled: jest.fn(async () => undefined) };
    const settings = { getSafetyPolicySettings: jest.fn(async () => DEFAULT_SAFETY_POLICY_SETTINGS) };
    const service = new OrdersDispatchService(
      { manager: { transaction: async (cb: (m: unknown) => unknown) => cb(manager) } } as never,
      realtime as never,
      { notifyOrderCancelled: jest.fn() } as never,
      { findById: jest.fn(async () => ({ id: 'u' })) } as never,
      { findByUserId: jest.fn(async () => null) } as never,
      {
        findByIdOrThrow: jest
          .fn()
          .mockResolvedValueOnce(order)
          .mockResolvedValue({ ...order, status: OrderStatus.CANCELLED, cancellationFee: 3000 }),
      } as never,
      statusTransition as never,
      undefined,
      undefined,
      settings as never,
      audit as never,
      signals as never,
    );
    return {
      service,
      saved,
      updates,
      audit,
      signals,
      statusTransition,
      realtime,
      setAffected: (n: number) => (affected = n),
    };
  }

  describe('kech bekor qilish', () => {
    it("bepul oyna ichida — jarimasiz, oddiy atomik bekor qilish", async () => {
      const { service, saved, statusTransition } = build({ acceptedAt: minutesAgo(1) });
      await service.cancelOrder('p-1', UserRole.PASSENGER, 'ride-1', undefined, { expectedFee: 0 });
      expect(saved).toHaveLength(0);
      expect(statusTransition.updateOrderStatusAtomic).toHaveBeenCalledWith(
        'ride-1',
        expect.any(Array),
        expect.objectContaining({ status: OrderStatus.CANCELLED, cancelledBy: 'passenger', cancelledAt: expect.any(Date) }),
      );
    });

    it("2 daqiqadan keyin, ilova 3000 ni ko'rsatgan — hamyon yetsa yechiladi, haydovchiga to'liq", async () => {
      const { service, saved, updates, audit } = build({}, { walletBalance: 10_000 });
      await service.cancelOrder('p-1', UserRole.PASSENGER, 'ride-1', 'kech', { expectedFee: 3000 });
      expect(updates[0]).toMatchObject({ status: OrderStatus.CANCELLED, cancelledBy: 'passenger' });
      expect(saved).toEqual([
        expect.objectContaining({
          userId: 'p-1',
          orderId: 'ride-1',
          amount: 3000,
          type: TransactionType.DEBIT,
          status: TransactionStatus.COMPLETED,
          externalId: 'taxi_fee_charge_ride-1',
        }),
        expect.objectContaining({
          userId: 'driver-1',
          amount: 3000,
          type: TransactionType.CREDIT,
          status: TransactionStatus.COMPLETED,
          externalId: 'taxi_fee_payout_ride-1',
        }),
      ]);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'order.cancel_fee', amount: 3000, metadata: expect.objectContaining({ kind: 'late_cancel' }) }),
        expect.anything(),
      );
    });

    it("hamyon yetmasa — yo'lovchi qarzi (PENDING), haydovchi ulushi ham PENDING", async () => {
      const { service, saved } = build({ status: OrderStatus.ARRIVED, arrivedAt: minutesAgo(1) }, { walletBalance: 1000 });
      await service.cancelOrder('p-1', UserRole.PASSENGER, 'ride-1', undefined, { expectedFee: 3000 });
      expect(saved.map((row) => row.status)).toEqual([TransactionStatus.PENDING, TransactionStatus.PENDING]);
    });

    it("ilova kamroq ko'rsatgan bo'lsa — 409 (qayta tasdiqlash), hech narsa yozilmaydi", async () => {
      const { service, saved, statusTransition } = build();
      const error = await service
        .cancelOrder('p-1', UserRole.PASSENGER, 'ride-1', undefined, { expectedFee: 0 })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({ code: 'CANCEL_FEE_CHANGED', details: { fee: 3000 } });
      expect(saved).toHaveLength(0);
      expect(statusTransition.updateOrderStatusAtomic).not.toHaveBeenCalled();
    });

    it("eski ilova (narxni ko'rsatmaydi) — jarima qo'llanmaydi", async () => {
      const { service, saved, statusTransition } = build();
      await service.cancelOrder('p-1', UserRole.PASSENGER, 'ride-1', undefined, { legacyClient: true });
      expect(saved).toHaveLength(0);
      expect(statusTransition.updateOrderStatusAtomic).toHaveBeenCalled();
    });

    it('poyga: holat o\'zgargan — 409, pul yozilmaydi', async () => {
      const { service, saved, setAffected } = build({}, { walletBalance: 10_000 });
      setAffected(0);
      await expect(
        service.cancelOrder('p-1', UserRole.PASSENGER, 'ride-1', undefined, { expectedFee: 3000 }),
      ).rejects.toThrow(ConflictException);
      expect(saved).toHaveLength(0);
    });

    it('narx so\'rovi faqat buyurtma egasiga', async () => {
      const { service } = build();
      await expect(service.quoteCancelFee('driver-1', UserRole.DRIVER, 'ride-1')).rejects.toThrow(ForbiddenException);
      const own = build();
      await expect(own.service.quoteCancelFee('p-1', UserRole.PASSENGER, 'ride-1')).resolves.toMatchObject({
        fee: 3000,
        reason: 'after_free_window',
      });
    });
  });

  describe("haydovchi bekor qilishi", () => {
    it('pul yo\'q, lekin signal sanaladi', async () => {
      const { service, saved, signals } = build();
      await service.cancelOrder('driver-1', UserRole.DRIVER, 'ride-1', 'mashina buzildi');
      expect(saved).toHaveLength(0);
      expect(signals.onDriverCancelled).toHaveBeenCalledWith('driver-1', expect.any(Date));
    });

    it("signal xatosi bekor qilishni buzmaydi", async () => {
      const { service, signals } = build();
      signals.onDriverCancelled.mockRejectedValueOnce(new Error('db'));
      await expect(service.cancelOrder('driver-1', UserRole.DRIVER, 'ride-1')).resolves.toBeDefined();
    });
  });

  describe("yo'lovchi chiqmadi", () => {
    it('5 daqiqadan oldin — 400 (kutish vaqti bilan)', async () => {
      const { service } = build({ status: OrderStatus.ARRIVED, arrivedAt: minutesAgo(2) });
      const error = await service.markNoShow('driver-1', 'ride-1').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'NO_SHOW_NOT_ALLOWED',
        details: { reason: 'too_early', waitUntil: expect.any(String) },
      });
    });

    it("5 daqiqadan keyin — bekor (haydovchi, no_show), 5000 haydovchiga; signal sanalmaydi", async () => {
      const { service, saved, updates, signals } = build({ status: OrderStatus.ARRIVED, arrivedAt: minutesAgo(6) }, { walletBalance: 0 });
      await service.markNoShow('driver-1', 'ride-1');
      expect(updates[0]).toMatchObject({ status: OrderStatus.CANCELLED, cancelledBy: 'driver', cancelReason: 'no_show' });
      expect(saved.map((row) => [row.type, row.amount])).toEqual([
        [TransactionType.DEBIT, 5000],
        [TransactionType.CREDIT, 5000],
      ]);
      expect(signals.onDriverCancelled).not.toHaveBeenCalled();
    });

    it('begona haydovchi — 403', async () => {
      const { service } = build({ status: OrderStatus.ARRIVED, arrivedAt: minutesAgo(6) });
      await expect(service.markNoShow('driver-2', 'ride-1')).rejects.toThrow(ForbiddenException);
    });
  });

  it('Transaction entity import (daftar sinfi) ishlatiladi', () => {
    expect(Transaction).toBeDefined();
  });
});
