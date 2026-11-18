import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { UserRole } from '../../database/entities/user.entity';
import { walletDebtReason } from './wallet-debt';
import { WalletDebtService } from './wallet-debt.service';

interface Row {
  id: string;
  userId: string;
  orderId: string | null;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  externalId: string | null;
  driverId?: string | null;
}

/** Mock: SQL'ni emas, QOIDANI sinaydi (SQL haqiqiy bazada tekshirilgan). */
function build(opts: { rows?: Row[]; balance?: number; bonus?: number; limit?: number } = {}) {
  const rows = opts.rows ?? [];
  let balance = opts.balance ?? 0;
  const open = () => rows.filter((r) => r.userId === 'p1' && r.status === TransactionStatus.PENDING && r.type === TransactionType.DEBIT);
  const ledger = {
    createQueryBuilder: () => {
      const qb = { select: () => qb, where: () => qb, getRawOne: async () => ({ balance: String(balance) }) };
      return qb;
    },
    update: jest.fn(async (where: { id: string; status?: TransactionStatus }, changes: { status: TransactionStatus }) => {
      const row = rows.find((r) => r.id === where.id && (!where.status || r.status === where.status));
      if (!row) return { affected: 0 };
      row.status = changes.status;
      if (changes.status === TransactionStatus.COMPLETED && row.userId === 'p1') balance -= row.amount;
      return { affected: 1 };
    }),
    find: jest.fn(async ({ where }: { where: { orderId: string; userId: string } }) =>
      rows.filter((r) => r.orderId === where.orderId && r.userId === where.userId && r.status === TransactionStatus.PENDING),
    ),
    save: jest.fn(async (row: Row) => {
      rows.push({ ...row, id: `saved-${rows.length}` });
      if (row.type === TransactionType.CREDIT) balance += row.amount;
      return row;
    }),
  };
  const manager = {
    getRepository: () => ledger,
    query: jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('pg_advisory_xact_lock')) return [];
      if (sql.includes('LEFT JOIN orders')) {
        return open().map((r) => ({
          id: r.id,
          amount: String(r.amount),
          order_id: r.orderId,
          external_id: r.externalId,
          created_at: new Date(0),
          driver_id: r.driverId ?? null,
          cancelled_by: null,
          delivery_failed_at: null,
        }));
      }
      if (sql.includes('SELECT 1 FROM transactions')) return open().filter((r) => r.orderId === params[1]);
      if (sql.includes('UPDATE drivers')) return [[], 0];
      return [{ bonus: String(opts.bonus ?? 0) }];
    }),
  };
  const dataSource = { manager, transaction: jest.fn(async (work: (m: unknown) => unknown) => work(manager)) };
  const drivers = {
    adjustBalanceWithin: jest.fn(async () => ({ driverId: 'drv', newBalance: 0, wentOffline: false })),
    takeOfflineInRedis: jest.fn(),
  };
  const audit = { record: jest.fn(async () => ({ id: 'a' })) };
  const settings = {
    getWalletTopupSettings: jest.fn(async () => ({
      walletTopupEnabled: true,
      walletTopupMin: 10000,
      manualAdjustmentManagerLimit: opts.limit ?? 500000,
    })),
    getPublicSettings: jest.fn(async () => ({ supportPhone: '+998711234567' })),
    cardPaymentsAvailable: jest.fn(() => false),
  };
  const notifier = { balanceChanged: jest.fn() };
  const service = new WalletDebtService(
    ledger as never,
    dataSource as never,
    drivers as never,
    audit as never,
    settings as never,
    notifier as never,
  );
  return { service, rows, manager, ledger, drivers, audit, notifier, settings };
}

const debit = (id: string, amount: number, over: Partial<Row> = {}): Row => ({
  id,
  userId: 'p1',
  orderId: `order-${id}`,
  amount,
  type: TransactionType.DEBIT,
  status: TransactionStatus.PENDING,
  externalId: null,
  driverId: 'd1',
  ...over,
});
const driverLeg = (id: string, orderId: string, amount: number, type = TransactionType.CREDIT): Row => ({
  id,
  userId: 'd1',
  orderId,
  amount,
  type,
  status: TransactionStatus.PENDING,
  externalId: type === TransactionType.DEBIT ? 'commission' : null,
});

describe('WalletDebtService (INCIDENT-POLICY §7)', () => {
  describe('settleWithin', () => {
    it('bonus qarzni yopmaydi — haydovchiga yechiladigan pul bo\'lib o\'tmasin', async () => {
      const { service, rows, manager, drivers } = build({ rows: [debit('a', 3000)], balance: 50000, bonus: 50000 });
      const closure = await service.settleWithin(manager as never, 'p1', 'wallet', 'p1');
      expect(closure.closed).toEqual([]);
      expect(rows[0].status).toBe(TransactionStatus.PENDING);
      expect(drivers.adjustBalanceWithin).not.toHaveBeenCalled();
    });

    it('faqat bonusdan ORTIQ qismi sarflanadi', async () => {
      const { service, rows, manager } = build({ rows: [debit('a', 3000), debit('b', 3000)], balance: 54000, bonus: 50000 });
      await service.settleWithin(manager as never, 'p1', 'wallet', 'p1');
      expect(rows.map((r) => r.status)).toEqual([TransactionStatus.COMPLETED, TransactionStatus.PENDING]);
    });

    it("eskisidan boshlaydi; yetmagani o'tkazib yuboriladi, kichigi yopiladi", async () => {
      const { service, rows, manager } = build({ rows: [debit('a', 10000), debit('b', 3000)], balance: 4000 });
      const closure = await service.settleWithin(manager as never, 'p1', 'topup', 'p1', { topupId: 't1' });
      expect(rows.map((r) => r.status)).toEqual([TransactionStatus.PENDING, TransactionStatus.COMPLETED]);
      expect(closure.total).toBe(3000);
    });

    it('haydovchi oyoqlarini ochadi va audit yozadi', async () => {
      const { service, rows, manager, drivers, audit } = build({
        rows: [debit('a', 10000), driverLeg('c', 'order-a', 10000), driverLeg('d', 'order-a', 1000, TransactionType.DEBIT)],
        balance: 10000,
      });
      const closure = await service.settleWithin(manager as never, 'p1', 'topup', 'p1', { topupId: 't1' });
      expect(rows.every((r) => r.status === TransactionStatus.COMPLETED)).toBe(true);
      expect(drivers.adjustBalanceWithin).toHaveBeenCalledWith(manager, 'd1', 9000);
      expect(closure.releases).toEqual([expect.objectContaining({ driverUserId: 'd1', netPayout: 9000 })]);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'wallet.debt_settled',
          targetId: 'p1',
          amount: 10000,
          metadata: expect.objectContaining({ debtId: 'a', source: 'topup', topupId: 't1', driverPayout: 9000 }),
        }),
        manager,
      );
    });

    it('buyurtmada yana ochiq qarz bo\'lsa haydovchi oyoqlari kutadi', async () => {
      const { service, rows, manager, drivers } = build({
        rows: [debit('a', 1000, { orderId: 'o' }), debit('b', 9000, { orderId: 'o' }), driverLeg('c', 'o', 10000)],
        balance: 1000,
      });
      await service.settleWithin(manager as never, 'p1', 'wallet', 'p1');
      expect(rows[0].status).toBe(TransactionStatus.COMPLETED);
      expect(rows[2].status).toBe(TransactionStatus.PENDING);
      expect(drivers.adjustBalanceWithin).not.toHaveBeenCalled();
    });

    it('parallel yutqazgan da\'vo qayta yozmaydi: audit ham, ochish ham yo\'q', async () => {
      const { service, ledger, manager, audit, drivers } = build({ rows: [debit('a', 1000)], balance: 1000 });
      ledger.update.mockResolvedValueOnce({ affected: 0 });
      const closure = await service.settleWithin(manager as never, 'p1', 'wallet', 'p1');
      expect(closure.closed).toEqual([]);
      expect(audit.record).not.toHaveBeenCalled();
      expect(drivers.adjustBalanceWithin).not.toHaveBeenCalled();
    });

    it('takroriy chaqiruv — hech narsa', async () => {
      const { service, manager, audit } = build({ rows: [debit('a', 1000)], balance: 5000 });
      await service.settleWithin(manager as never, 'p1', 'wallet', 'p1');
      await service.settleWithin(manager as never, 'p1', 'wallet', 'p1');
      expect(audit.record).toHaveBeenCalledTimes(1);
    });
  });

  describe('close (menejer)', () => {
    const manager = { id: 'm1', role: UserRole.MANAGER };

    it('cash_received: CREDIT + DEBIT COMPLETED, haydovchi ochiladi, qoldiq o\'zgarmaydi', async () => {
      const { service, rows, ledger, drivers, audit } = build({
        rows: [debit('a', 3000), driverLeg('c', 'order-a', 3000)],
        balance: 0,
      });
      const result = await service.close(manager, 'p1', { mode: 'cash_received', reason: 'Ofisda oldim' });
      expect(result).toMatchObject({ closedCount: 1, total: 3000 });
      expect(rows[0].status).toBe(TransactionStatus.COMPLETED);
      expect(ledger.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: TransactionType.CREDIT, amount: 3000, externalId: 'wallet_debt_cash_a', orderId: null }),
      );
      expect(drivers.adjustBalanceWithin).toHaveBeenCalledWith(expect.anything(), 'd1', 3000);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'wallet.debt_cash_received', actorUserId: 'm1', note: 'Ofisda oldim' }),
        expect.anything(),
      );
    });

    it('write_off: DEBIT refunded (kirimsiz), haydovchi baribir oladi', async () => {
      const { service, rows, ledger, drivers, audit } = build({ rows: [debit('a', 3000), driverLeg('c', 'order-a', 3000)] });
      await service.close(manager, 'p1', { mode: 'write_off', reason: 'Nizo hal qilindi' });
      expect(rows[0].status).toBe(TransactionStatus.REFUNDED);
      expect(ledger.save).not.toHaveBeenCalled();
      expect(rows[1].status).toBe(TransactionStatus.COMPLETED);
      expect(drivers.adjustBalanceWithin).toHaveBeenCalledWith(expect.anything(), 'd1', 3000);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'wallet.debt_written_off' }),
        expect.anything(),
      );
    });

    it('menejer chegarasi — tanlangan summa bo\'yicha; admin cheklanmaydi', async () => {
      const over = build({ rows: [debit('a', 6000)], limit: 5000 });
      await expect(over.service.close(manager, 'p1', { mode: 'write_off', reason: 'sabab' })).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'MANUAL_ADJUSTMENT_LIMIT' }),
      });
      expect(over.rows[0].status).toBe(TransactionStatus.PENDING);

      const part = build({ rows: [debit('a', 6000), debit('b', 1000)], limit: 5000 });
      await expect(
        part.service.close(manager, 'p1', { mode: 'write_off', reason: 'sabab', transactionIds: ['b'] }),
      ).resolves.toMatchObject({ closedCount: 1 });

      const admin = build({ rows: [debit('a', 6000)], limit: 5000 });
      await expect(
        admin.service.close({ id: 'a1', role: UserRole.ADMIN }, 'p1', { mode: 'write_off', reason: 'sabab' }),
      ).resolves.toMatchObject({ closedCount: 1 });
    });

    it("o'z qarzi va bo'sh sabab — rad; takroriy bosish — no-op", async () => {
      const { service } = build({ rows: [debit('a', 1000)] });
      await expect(service.close({ id: 'p1', role: UserRole.MANAGER }, 'p1', { mode: 'write_off', reason: 'x y z' })).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.close(manager, 'p1', { mode: 'write_off', reason: '   ' })).rejects.toThrow(BadRequestException);
      await service.close(manager, 'p1', { mode: 'cash_received', reason: 'birinchi' });
      await expect(service.close(manager, 'p1', { mode: 'cash_received', reason: 'ikkinchi' })).resolves.toMatchObject({
        closedCount: 0,
        total: 0,
      });
    });
  });

  describe('view', () => {
    it('jami, sabab, qancha to\'ldirish kerak; ichki maydon chiqmaydi', async () => {
      const { service } = build({ rows: [debit('a', 3000)], balance: 1000 });
      const view = await service.view('p1');
      expect(view).toMatchObject({
        total: 3000,
        realBalance: 1000,
        canSettleNow: false,
        topUpNeeded: 2000,
        minTopUp: 2000,
        topUpAvailable: false,
        supportPhone: '+998711234567',
      });
      expect(view.items[0]).not.toHaveProperty('driverUserId');
    });

    it('hamyonda pul bor — canSettleNow', async () => {
      const { service } = build({ rows: [debit('a', 3000)], balance: 3000 });
      await expect(service.view('p1')).resolves.toMatchObject({ canSettleNow: true, topUpNeeded: 0, minTopUp: 10000 });
    });
  });

  it('commit\'dan keyingi xabar: MoneyContext bo\'lsa navbatga, bo\'lmasa darhol', async () => {
    const { service, notifier } = build();
    const closure = { closed: [{ id: 'a', amount: 3000, reason: 'late_cancel' as const, orderId: 'o', createdAt: new Date() }], total: 3000, releases: [] };
    const ctx = { manager: {} as never, afterCommit: [] as Array<() => Promise<void>> };
    await service.afterCommit(ctx, 'p1', closure);
    expect(notifier.balanceChanged).not.toHaveBeenCalled();
    await ctx.afterCommit[0]();
    expect(notifier.balanceChanged).toHaveBeenCalledWith('p1', expect.objectContaining({ reason: 'debt_closed', delta: -3000 }));
  });
});

describe('walletDebtReason', () => {
  const row = (over: Partial<Parameters<typeof walletDebtReason>[0]>) => ({
    external_id: null,
    cancelled_by: null,
    delivery_failed_at: null,
    ...over,
  });

  it.each([
    [row({}), 'ride_shortfall'],
    [row({ delivery_failed_at: new Date() }), 'delivery_refused'],
    [row({ external_id: 'taxi_fee_charge_x', cancelled_by: 'passenger' }), 'late_cancel'],
    [row({ external_id: 'taxi_fee_charge_x', cancelled_by: 'driver' }), 'no_show'],
    [row({ external_id: 'incident_penalty_x' }), 'incident_penalty'],
  ])('%j → %s', (input, expected) => {
    expect(walletDebtReason(input)).toBe(expected);
  });
});

