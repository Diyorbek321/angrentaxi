import { SupplySnapshot, fulfilmentRate } from './supply-report.types';
import { formatSupplyReport, supplyAlerts } from './supply-report.format';

const snapshot = (overrides: Partial<SupplySnapshot> = {}): SupplySnapshot => ({
  period: { from: '2026-10-27', to: '2026-10-28' },
  drivers: { approved: 40, pendingApproval: 0, blocked: 2, onlineNow: 12, negativeBalance: 0, newRegistrations: 1 },
  activity: { activeDrivers: 25, completedRides: 180 },
  demand: {
    orders: 200,
    completed: 180,
    noDriverFound: 8,
    passengerGaveUp: 4,
    shortageHours: [
      { hour: 8, orders: 30, unmet: 6 },
      { hour: 18, orders: 25, unmet: 3 },
    ],
  },
  queue: { kycPending: 0, kycOldestHours: null },
  churning: [],
  topDrivers: [{ driverId: 'd1', name: 'Ali V.', phone: '+998901112233', daysSinceLastRide: 0, rides: 22 }],
  ...overrides,
});

describe('fulfilmentRate', () => {
  it('is completed / orders in percent', () => {
    expect(fulfilmentRate(snapshot())).toBe(90);
  });
  it('is null with no orders', () => {
    expect(fulfilmentRate(snapshot({ demand: { ...snapshot().demand, orders: 0, completed: 0 } }))).toBeNull();
  });
});

describe('supplyAlerts', () => {
  it('is quiet on a healthy day', () => {
    expect(supplyAlerts(snapshot())).toEqual([]);
  });

  it('flags low fulfilment with the worst hour', () => {
    const s = snapshot({ demand: { ...snapshot().demand, completed: 140, noDriverFound: 40 } });
    const alerts = supplyAlerts(s);
    expect(alerts.some((a) => a.includes('70%') && a.includes('08:00'))).toBe(true);
  });

  it('does not judge fulfilment on a handful of orders', () => {
    const s = snapshot({ demand: { ...snapshot().demand, orders: 5, completed: 1 } });
    expect(supplyAlerts(s).some((a) => a.includes('bajarildi'))).toBe(false);
  });

  it('flags KYC waiting longer than a day, drivers locked out by debt, and churn', () => {
    const s = snapshot({
      queue: { kycPending: 3, kycOldestHours: 30 },
      drivers: { ...snapshot().drivers, negativeBalance: 4 },
      churning: [
        { driverId: 'd2', name: 'Vali', phone: '+998900000002', daysSinceLastRide: 9, rides: 40 },
      ],
    });
    const alerts = supplyAlerts(s);
    expect(alerts.some((a) => a.includes('3 ta') && a.includes('30 soat'))).toBe(true);
    expect(alerts.some((a) => a.includes('4 ta') && a.includes('manfiy'))).toBe(true);
    expect(alerts.some((a) => a.includes('1 ta') && a.includes('7+'))).toBe(true);
  });

  it('a fresh KYC submission is not an alert yet', () => {
    expect(supplyAlerts(snapshot({ queue: { kycPending: 1, kycOldestHours: 2 } }))).toEqual([]);
  });
});

describe('formatSupplyReport', () => {
  it('shows the key numbers and never prints phone numbers', () => {
    const s = snapshot({
      churning: [{ driverId: 'd2', name: 'Vali', phone: '+998900000002', daysSinceLastRide: 9, rides: 40 }],
    });
    const text = formatSupplyReport('Haydovchilar — 27.10.2026', s);

    expect(text).toContain('Haydovchilar — 27.10.2026');
    expect(text).toContain('Bajarildi: 90%');
    expect(text).toContain('Faol haydovchilar: 25');
    expect(text).toContain('08:00');
    expect(text).toContain('Vali — 9 kun');
    expect(text).not.toContain('+998');
  });

  it('escapes HTML in driver names', () => {
    const s = snapshot({ topDrivers: [{ driverId: 'x', name: '<b>Ali</b>', phone: '', daysSinceLastRide: 0, rides: 1 }] });
    expect(formatSupplyReport('T', s)).toContain('&lt;b&gt;Ali&lt;/b&gt;');
  });
});
