import { FinanceSnapshot, netRevenue } from './finance-report.types';
import { financeAlerts, formatFinanceReport, formatSom } from './finance-report.format';

const snapshot = (overrides: Partial<FinanceSnapshot> = {}): FinanceSnapshot => ({
  period: { from: '2026-10-27', to: '2026-10-28' },
  rides: { completed: 50, cancelled: 5, gross: 1_200_000, cash: 900_000, card: 250_000, wallet: 50_000 },
  vendors: { foodDelivered: 3, foodGross: 150_000, marketDelivered: 1, marketGross: 80_000 },
  revenue: {
    rideCommission: 100_000,
    vendorCommission: 20_000,
    shiftPassesSold: 3,
    shiftPassRevenue: 30_000,
    shiftPassRefunds: 0,
  },
  costs: { ridePromos: 10_000, referralBonuses: 10_000, driverBonuses: 5_000 },
  cashFlow: { walletTopups: 200_000, withdrawalsPaid: 100_000 },
  balances: {
    owedToDrivers: 500_000,
    driversDebt: 300_000,
    pendingWithdrawals: 0,
    pendingWithdrawalsCount: 0,
  },
  ...overrides,
});

describe('netRevenue', () => {
  it('is revenue minus platform-funded costs', () => {
    expect(netRevenue(snapshot())).toBe(100_000 + 20_000 + 30_000 - 25_000);
  });
});

describe('formatSom', () => {
  it('groups thousands with spaces and rounds', () => {
    expect(formatSom(1234567.6)).toBe('1 234 568');
    expect(formatSom(-25000)).toBe('−25 000');
    expect(formatSom(0)).toBe('0');
  });
});

describe('financeAlerts', () => {
  it('is silent when today matches the recent average', () => {
    expect(financeAlerts(snapshot(), snapshot())).toEqual([]);
  });

  it('flags a 30%+ drop in rides and in net revenue against the baseline', () => {
    const today = snapshot({
      rides: { ...snapshot().rides, completed: 30 },
      revenue: { ...snapshot().revenue, rideCommission: 40_000 },
    });

    const alerts = financeAlerts(today, snapshot());

    expect(alerts.some((a) => a.includes('Safarlar') && a.includes('40%'))).toBe(true);
    expect(alerts.some((a) => a.includes('Sof daromad'))).toBe(true);
  });

  it('does not compare against an empty baseline (first days after launch)', () => {
    const empty = snapshot({
      rides: { completed: 0, cancelled: 0, gross: 0, cash: 0, card: 0, wallet: 0 },
      revenue: { rideCommission: 0, vendorCommission: 0, shiftPassesSold: 0, shiftPassRevenue: 0, shiftPassRefunds: 0 },
      costs: { ridePromos: 0, referralBonuses: 0, driverBonuses: 0 },
    });
    expect(financeAlerts(snapshot({ rides: { ...snapshot().rides, completed: 1 } }), empty)).toEqual([]);
  });

  it('flags a high cancellation rate only with enough orders to mean something', () => {
    const many = snapshot({ rides: { ...snapshot().rides, completed: 30, cancelled: 20 } });
    const few = snapshot({ rides: { ...snapshot().rides, completed: 2, cancelled: 3 } });

    expect(financeAlerts(many, null).some((a) => a.includes('bekor'))).toBe(true);
    expect(financeAlerts(few, null).some((a) => a.includes('bekor'))).toBe(false);
  });

  it('flags negative net revenue and pending withdrawals as action items', () => {
    const s = snapshot({
      costs: { ridePromos: 500_000, referralBonuses: 0, driverBonuses: 0 },
      balances: { ...snapshot().balances, pendingWithdrawals: 150_000, pendingWithdrawalsCount: 2 },
    });

    const alerts = financeAlerts(s, null);

    expect(alerts.some((a) => a.includes('zarar'))).toBe(true);
    expect(alerts.some((a) => a.includes('2 ta') && a.includes('150 000'))).toBe(true);
  });
});

describe('formatFinanceReport', () => {
  it('leads with net revenue and lists every section', () => {
    const text = formatFinanceReport('Kunlik hisobot — 27.10.2026', snapshot(), snapshot());

    expect(text.split('\n')[0]).toContain('Kunlik hisobot — 27.10.2026');
    expect(text).toContain("Platforma sof daromadi: 125 000 so'm");
    expect(text).toContain('Safarlar: 50 ta');
    expect(text).toContain('naqd 900 000');
    expect(text).toContain('Haydovchilarning platformaga qarzi: 300 000');
    expect(text).toContain('me\'yorida');
  });

  it('shows the alert block instead of the all-clear line when something is off', () => {
    const s = snapshot({ balances: { ...snapshot().balances, pendingWithdrawals: 1, pendingWithdrawalsCount: 1 } });

    const text = formatFinanceReport('Hisobot', s, null);

    expect(text).toContain('Diqqat');
    expect(text).not.toContain("me'yorida");
  });
});
