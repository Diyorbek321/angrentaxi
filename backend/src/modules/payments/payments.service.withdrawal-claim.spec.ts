import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Transaction, TransactionType } from '../../database/entities/transaction.entity';
import { WithdrawalRequest, WithdrawalStatus } from '../../database/entities/withdrawal-request.entity';

/**
 * processWithdrawal — holat o'zgarishi SHARTLI DA'VO bilan (audit #1).
 *
 * Mock'langan repo haqiqiy poygani isbotlay olmaydi; bu yerda tekshiriladi:
 *  · da'vo `update({ id, status: <kutilgan> })` orqali va daftardan OLDIN;
 *  · 0 qator ta'sirlansa — xato, daftarga HECH NARSA yozilmaydi;
 *  · qaytarim CREDIT va holat BITTA tranzaksiyada;
 *  · PAID: provayderdan oldin `payoutStartedAt` da'vosi (faqat bitta chaqiruvchi
 *    yuboradi), provayder yiqilsa da'vo bo'shatiladi va holat APPROVED qoladi.
 */
describe('PaymentsService.processWithdrawal — conditional claim', () => {
  const base = (over: Partial<WithdrawalRequest> = {}): WithdrawalRequest =>
    ({
      id: 'w-1',
      driverId: 'driver-1',
      amount: 40000,
      status: WithdrawalStatus.PENDING,
      payoutDestination: '8600',
      requestedAt: new Date('2026-10-01T00:00:00Z'),
      processedAt: null,
      adminNote: null,
      payoutReference: null,
      payoutStartedAt: null,
      ...over,
    }) as WithdrawalRequest;

  function build(row: WithdrawalRequest, opts: { affected?: number[]; sendError?: Error } = {}) {
    const events: string[] = [];
    const affected = [...(opts.affected ?? [])];
    const withdrawalRepo = {
      findOne: jest.fn(async () => row),
      save: jest.fn(),
      update: jest.fn(async (where: Record<string, unknown>, patch: Record<string, unknown>) => {
        events.push(`update:${JSON.stringify(where)}->${JSON.stringify(patch)}`);
        return { affected: affected.length ? affected.shift() : 1 };
      }),
    };
    const ledger = {
      save: jest.fn(async (r: Record<string, unknown>) => {
        events.push(`ledger:${String(r.externalId)}`);
        return r;
      }),
    };
    const manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('pg_advisory_xact_lock')) events.push('lock');
        if (sql.includes('UPDATE drivers')) events.push('sync');
        return [[], 0];
      }),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Transaction) return ledger;
        if (entity === WithdrawalRequest) return withdrawalRepo;
        throw new Error('unexpected entity');
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => {
        events.push('tx:begin');
        const out = await cb(manager);
        events.push('tx:commit');
        return out;
      }),
      manager,
    };
    const payout = {
      name: 'manual',
      send: jest.fn(async () => {
        events.push('send');
        if (opts.sendError) throw opts.sendError;
        return { reference: 'ref-1', settled: true };
      }),
    };
    const service = new PaymentsService(
      ledger as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      withdrawalRepo as never,
      {} as never,
      {} as never,
      {} as never,
      dataSource as never,
      {} as never,
      payout as never,
    );
    return { service, events, withdrawalRepo, ledger, payout, dataSource };
  }

  describe('REJECT', () => {
    it("da'vo → qulf → qaytarim → sinxron, hammasi BITTA tranzaksiyada", async () => {
      const { service, events, withdrawalRepo } = build(base());
      const result = await service.processWithdrawal('w-1', { status: WithdrawalStatus.REJECTED, adminNote: 'x' });

      expect(result).toMatchObject({ status: WithdrawalStatus.REJECTED, adminNote: 'x' });
      expect(withdrawalRepo.update.mock.calls[0][0]).toEqual({ id: 'w-1', status: WithdrawalStatus.PENDING });
      expect(withdrawalRepo.update.mock.calls[0][1]).toMatchObject({ status: WithdrawalStatus.REJECTED, adminNote: 'x' });
      const claim = events.findIndex((e) => e.startsWith('update:'));
      expect(events.indexOf('tx:begin')).toBeLessThan(claim);
      expect(claim).toBeLessThan(events.indexOf('ledger:withdrawal_refund_w-1'));
      expect(events.indexOf('lock')).toBeLessThan(events.indexOf('ledger:withdrawal_refund_w-1'));
      expect(events.indexOf('sync')).toBeLessThan(events.indexOf('tx:commit'));
      // Eski yo'l: oxirida to'liq qatorni `save` qilish — endi yo'q.
      expect(withdrawalRepo.save).not.toHaveBeenCalled();
    });

    it("da'vo 0 qator (parallel REJECT/APPROVE yutdi) — xato, qaytarim YOZILMAYDI", async () => {
      const { service, ledger } = build(base(), { affected: [0] });
      await expect(
        service.processWithdrawal('w-1', { status: WithdrawalStatus.REJECTED }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(ledger.save).not.toHaveBeenCalled();
    });

    it('qaytarim CREDIT summasi va belgisi', async () => {
      const { service, ledger } = build(base());
      await service.processWithdrawal('w-1', { status: WithdrawalStatus.REJECTED });
      expect(ledger.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'driver-1',
          amount: 40000,
          type: TransactionType.CREDIT,
          externalId: 'withdrawal_refund_w-1',
        }),
      );
    });
  });

  describe('APPROVE', () => {
    it("pending'dan shartli o'tadi, daftarga tegmaydi", async () => {
      const { service, withdrawalRepo, ledger } = build(base());
      await expect(
        service.processWithdrawal('w-1', { status: WithdrawalStatus.APPROVED }),
      ).resolves.toMatchObject({ status: WithdrawalStatus.APPROVED });
      expect(withdrawalRepo.update.mock.calls[0][0]).toEqual({ id: 'w-1', status: WithdrawalStatus.PENDING });
      expect(ledger.save).not.toHaveBeenCalled();
    });

    it("da'vo 0 qator — xato", async () => {
      const { service } = build(base(), { affected: [0] });
      await expect(
        service.processWithdrawal('w-1', { status: WithdrawalStatus.APPROVED }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('PAID — single-flight', () => {
    const approved = () => base({ status: WithdrawalStatus.APPROVED });

    it("provayderdan OLDIN da'vo (APPROVED + payoutStartedAt IS NULL); keyin PAID", async () => {
      const { service, events, withdrawalRepo, payout } = build(approved());
      const result = await service.processWithdrawal('w-1', { status: WithdrawalStatus.PAID, adminNote: 'sent' });

      expect(result).toMatchObject({ status: WithdrawalStatus.PAID, payoutReference: 'ref-1', adminNote: 'sent' });
      const [claimWhere, claimPatch] = withdrawalRepo.update.mock.calls[0];
      expect(claimWhere).toMatchObject({ id: 'w-1', status: WithdrawalStatus.APPROVED });
      expect(claimWhere).toHaveProperty('payoutStartedAt');
      expect(claimPatch.payoutStartedAt).toBeInstanceOf(Date);
      expect(events.findIndex((e) => e.startsWith('update:'))).toBeLessThan(events.indexOf('send'));
      expect(payout.send).toHaveBeenCalledWith({ amount: 40000, destination: '8600', withdrawalId: 'w-1' });
      const [finalWhere, finalPatch] = withdrawalRepo.update.mock.calls[1];
      expect(finalWhere).toMatchObject({ id: 'w-1', status: WithdrawalStatus.APPROVED });
      expect(finalPatch).toMatchObject({ status: WithdrawalStatus.PAID, payoutReference: 'ref-1' });
    });

    it("da'vo 0 qator (boshqa admin allaqachon yuboryapti) — provayder CHAQIRILMAYDI", async () => {
      const { service, payout } = build(approved(), { affected: [0] });
      await expect(
        service.processWithdrawal('w-1', { status: WithdrawalStatus.PAID }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(payout.send).not.toHaveBeenCalled();
    });

    it("provayder yiqilsa: da'vo bo'shatiladi, holat PAID ga O'TMAYDI", async () => {
      const { service, withdrawalRepo } = build(approved(), { sendError: new Error('provayder javob bermadi') });
      await expect(
        service.processWithdrawal('w-1', { status: WithdrawalStatus.PAID }),
      ).rejects.toThrow('provayder javob bermadi');

      expect(withdrawalRepo.update).toHaveBeenCalledTimes(2);
      const [releaseWhere, releasePatch] = withdrawalRepo.update.mock.calls[1];
      expect(releaseWhere).toMatchObject({ id: 'w-1', status: WithdrawalStatus.APPROVED });
      expect(releasePatch).toEqual({ payoutStartedAt: null });
      expect(
        withdrawalRepo.update.mock.calls.some(([, patch]) => (patch as { status?: string }).status === WithdrawalStatus.PAID),
      ).toBe(false);
    });

    it("yuborish boshlangan (payoutStartedAt bor) so'rov — darhol rad", async () => {
      const { service, payout } = build(base({ status: WithdrawalStatus.APPROVED, payoutStartedAt: new Date() }));
      await expect(
        service.processWithdrawal('w-1', { status: WithdrawalStatus.PAID }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(payout.send).not.toHaveBeenCalled();
    });
  });
});
