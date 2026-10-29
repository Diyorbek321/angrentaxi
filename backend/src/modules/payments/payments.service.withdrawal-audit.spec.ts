import { PaymentsService } from './payments.service';
import { Transaction } from '../../database/entities/transaction.entity';
import { WithdrawalRequest, WithdrawalStatus } from '../../database/entities/withdrawal-request.entity';
import { AUDIT_ACTIONS } from '../audit/audit-log.service';

/**
 * Pul yechish so'rovini kim tasdiqlagani / rad etgani / to'lagani audit
 * jurnaliga yoziladi. APPROVE/REJECT — holat bilan BITTA tranzaksiyada
 * (jurnalsiz holat o'zgarishi bo'lmasin); PAID — pul ketgandan keyin, jurnal
 * xatosi to'lovni "yiqilgan" deb ko'rsatmaydi.
 */
describe('PaymentsService.processWithdrawal — audit jurnali', () => {
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

  function build(row: WithdrawalRequest) {
    const withdrawalRepo = {
      findOne: jest.fn(async () => row),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    const ledger = { save: jest.fn(async (r: unknown) => r) };
    const manager = {
      query: jest.fn(async () => [[], 0]),
      getRepository: jest.fn((entity: unknown) => (entity === Transaction ? ledger : withdrawalRepo)),
    };
    const dataSource = {
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
      manager,
    };
    const payout = { name: 'manual', send: jest.fn(async () => ({ reference: 'ref-1', settled: true })) };
    const auditLog = { record: jest.fn().mockResolvedValue({}) };
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
      undefined,
      undefined,
      undefined,
      auditLog as never,
    );
    return { service, auditLog, manager };
  }

  it('APPROVE aktyor, summa va izoh bilan, tranzaksiya ichida yoziladi', async () => {
    const { service, auditLog, manager } = build(base());
    await service.processWithdrawal('w-1', { status: WithdrawalStatus.APPROVED, adminNote: 'ok' }, 'fin-1');
    expect(auditLog.record).toHaveBeenCalledWith(
      {
        actorUserId: 'fin-1',
        action: AUDIT_ACTIONS.withdrawalApprove,
        targetType: 'withdrawal',
        targetId: 'w-1',
        amount: 40000,
        note: 'ok',
        metadata: { ownerUserId: 'driver-1' },
      },
      manager,
    );
  });

  it('REJECT withdrawal.reject sifatida yoziladi', async () => {
    const { service, auditLog } = build(base());
    await service.processWithdrawal('w-1', { status: WithdrawalStatus.REJECTED, adminNote: 'karta xato' }, 'fin-1');
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.withdrawalReject, note: 'karta xato' }),
      expect.anything(),
    );
  });

  it("PAID provayder havolasi bilan yoziladi; jurnal yiqilsa ham to'lov natijasi qaytadi", async () => {
    const { service, auditLog } = build(base({ status: WithdrawalStatus.APPROVED }));
    auditLog.record.mockRejectedValueOnce(new Error('db down'));
    const result = await service.processWithdrawal('w-1', { status: WithdrawalStatus.PAID }, 'fin-1');
    expect(result.status).toBe(WithdrawalStatus.PAID);
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'fin-1',
        action: AUDIT_ACTIONS.withdrawalPaid,
        metadata: { ownerUserId: 'driver-1', payoutReference: 'ref-1', provider: 'manual', statusSaved: true },
      }),
    );
  });
});
