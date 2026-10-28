import { FraudSnapshot, SuspiciousPair } from './fraud-report.types';
import { formatFraudReport, fraudAlerts } from './fraud-report.format';

const pair = (overrides: Partial<SuspiciousPair> = {}): SuspiciousPair => ({
  passengerId: 'p1',
  passengerName: 'Laylo K.',
  passengerPhone: '+998901111111',
  driverUserId: 'd1',
  driverName: 'Bobur N.',
  driverPhone: '+998902222222',
  cancelledTogether: 0,
  completedTogether: 5,
  daysSinceLastTrip: 16,
  ...overrides,
});

const snapshot = (overrides: Partial<FraudSnapshot> = {}): FraudSnapshot => ({
  period: { from: '2026-10-27', to: '2026-10-28' },
  cancellations: { afterAccept: 2, afterArrival: 0, afterArrivalByDriver: 0, afterArrivalByPassenger: 0 },
  drivers: [],
  cancelPairs: [],
  lostRegulars: [],
  selfOrderReview: { flaggedInPeriod: 0, pending: 0, oldestPendingHours: null },
  ...overrides,
});

describe('fraudAlerts', () => {
  it('is quiet on a clean day', () => {
    expect(fraudAlerts(snapshot())).toEqual([]);
  });

  it('flags drivers, pairs, lost regulars and a stale review queue', () => {
    const alerts = fraudAlerts(
      snapshot({
        drivers: [
          { driverUserId: 'd1', name: 'Bobur N.', phone: '', accepted: 10, cancelledAfterAccept: 6, cancelledAfterArrival: 3 },
        ],
        cancelPairs: [pair({ cancelledTogether: 3 })],
        lostRegulars: [pair()],
        selfOrderReview: { flaggedInPeriod: 1, pending: 2, oldestPendingHours: 50 },
      }),
    );

    expect(alerts.some((a) => a.includes('1 ta haydovchi'))).toBe(true);
    expect(alerts.some((a) => a.includes('1 ta juftlik'))).toBe(true);
    expect(alerts.some((a) => a.includes('doimiy mijoz'))).toBe(true);
    expect(alerts.some((a) => a.includes('2 ta') && a.includes('50 soat'))).toBe(true);
  });

  it('a fresh review item is not an alert yet', () => {
    expect(fraudAlerts(snapshot({ selfOrderReview: { flaggedInPeriod: 1, pending: 1, oldestPendingHours: 3 } }))).toEqual([]);
  });
});

describe('formatFraudReport', () => {
  it('names people but never prints phone numbers', () => {
    const text = formatFraudReport(
      'Antifrod — 27.10.2026',
      snapshot({
        cancellations: { afterAccept: 5, afterArrival: 3, afterArrivalByDriver: 2, afterArrivalByPassenger: 1 },
        lostRegulars: [pair()],
      }),
    );

    expect(text).toContain('Antifrod — 27.10.2026');
    expect(text).toContain('yetib kelgach bekor: 3');
    expect(text).toContain('Bobur N. ↔ Laylo K.');
    expect(text).not.toContain('+998');
  });

  it('reminds that signals are not proof', () => {
    expect(formatFraudReport('T', snapshot({ lostRegulars: [pair()] }))).toContain('ayblov emas');
  });

  it('escapes HTML in names', () => {
    const text = formatFraudReport('T', snapshot({ lostRegulars: [pair({ driverName: '<i>x</i>' })] }));
    expect(text).toContain('&lt;i&gt;x&lt;/i&gt;');
  });
});
