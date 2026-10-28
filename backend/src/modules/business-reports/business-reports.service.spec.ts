import { BusinessReportsService } from './business-reports.service';
import { FinanceReportService } from './finance-report.service';
import { TelegramService } from './telegram.service';
import { SupplyReportService } from './supply-report.service';
import { SupplySnapshot } from './supply-report.types';
import { FinanceSnapshot } from './finance-report.types';

const snap = (from: string, to: string, completed = 10): FinanceSnapshot => ({
  period: { from, to },
  rides: { completed, cancelled: 0, gross: 0, cash: 0, card: 0, wallet: 0 },
  vendors: { foodDelivered: 0, foodGross: 0, marketDelivered: 0, marketGross: 0 },
  revenue: { rideCommission: 1000, vendorCommission: 0, shiftPassesSold: 0, shiftPassRevenue: 0, shiftPassRefunds: 0 },
  costs: { ridePromos: 0, referralBonuses: 0, driverBonuses: 0 },
  cashFlow: { walletTopups: 0, withdrawalsPaid: 0 },
  balances: { owedToDrivers: 0, driversDebt: 0, pendingWithdrawals: 0, pendingWithdrawalsCount: 0 },
});

const supplySnap = (from: string, to: string): SupplySnapshot => ({
  period: { from, to },
  drivers: { approved: 5, pendingApproval: 0, blocked: 0, onlineNow: 2, negativeBalance: 0, newRegistrations: 0 },
  activity: { activeDrivers: 3, completedRides: 10 },
  demand: { orders: 10, completed: 10, noDriverFound: 0, passengerGaveUp: 0, shortageHours: [] },
  queue: { kycPending: 0, kycOldestHours: null },
  churning: [],
  topDrivers: [],
});

describe('BusinessReportsService', () => {
  let finance: { snapshot: jest.Mock; baseline: jest.Mock };
  let telegram: { send: jest.Mock };
  let supply: { snapshot: jest.Mock };
  let service: BusinessReportsService;
  const NOW = new Date('2026-10-28T03:00:00Z'); // 08:00 Toshkent, chorshanba

  beforeEach(() => {
    finance = {
      snapshot: jest.fn(async (p) => snap(p.from, p.to)),
      baseline: jest.fn(async (p) => snap(p.from, p.to)),
    };
    telegram = { send: jest.fn().mockResolvedValue(true) };
    supply = { snapshot: jest.fn(async (p) => supplySnap(p.from, p.to)) };
    service = new BusinessReportsService(
      finance as unknown as FinanceReportService,
      supply as unknown as SupplyReportService,
      telegram as unknown as TelegramService,
    );
  });

  it('daily report covers yesterday and compares with the previous 7 days', async () => {
    await service.sendDaily(NOW);

    expect(finance.snapshot).toHaveBeenCalledWith({ from: '2026-10-27', to: '2026-10-28' });
    expect(finance.baseline).toHaveBeenCalledWith({ from: '2026-10-27', to: '2026-10-28' }, 7);
    expect(telegram.send.mock.calls[0][0]).toContain('Kunlik hisobot — 27.10.2026');
  });

  it('sends the drivers department report as a second message for the same day', async () => {
    await service.sendDaily(NOW);

    expect(supply.snapshot).toHaveBeenCalledWith({ from: '2026-10-27', to: '2026-10-28' });
    expect(telegram.send).toHaveBeenCalledTimes(2);
    expect(telegram.send.mock.calls[1][0]).toContain("Haydovchilar bo'limi — 27.10.2026");
  });

  it('a failing finance query still lets the drivers report go out', async () => {
    finance.snapshot.mockRejectedValue(new Error('boom'));

    await expect(service.sendDaily(NOW)).resolves.toBe(false);
    expect(telegram.send.mock.calls[1][0]).toContain("Haydovchilar bo'limi");
  });

  it('supplyReport() returns the snapshot with its alerts', async () => {
    const result = await service.supplyReport({ from: '2026-10-01', to: '2026-10-08' });

    expect(result.snapshot.activity.activeDrivers).toBe(3);
    expect(result.alerts).toEqual([]);
  });

  it('weekly report covers last Monday..Sunday and compares with the previous 4 weeks', async () => {
    await service.sendWeekly(NOW);

    expect(finance.snapshot).toHaveBeenCalledWith({ from: '2026-10-19', to: '2026-10-26' });
    expect(finance.baseline).toHaveBeenCalledWith({ from: '2026-10-19', to: '2026-10-26' }, 4);
    expect(telegram.send.mock.calls[0][0]).toContain('Haftalik hisobot — 19.10–25.10.2026');
  });

  it('a failing query is reported to Telegram instead of crashing the cron', async () => {
    finance.snapshot.mockRejectedValue(new Error('connection refused'));

    await expect(service.sendDaily(NOW)).resolves.toBe(false);
    expect(telegram.send.mock.calls[0][0]).toContain('tuzib bo');
  });

  it('report() returns numbers, net revenue and alerts for the skills API', async () => {
    const result = await service.report({ from: '2026-10-01', to: '2026-10-08' });

    expect(result.netRevenue).toBe(1000);
    expect(result.snapshot.period).toEqual({ from: '2026-10-01', to: '2026-10-08' });
    expect(finance.baseline).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-08' }, 4);
    expect(Array.isArray(result.alerts)).toBe(true);
  });
});
