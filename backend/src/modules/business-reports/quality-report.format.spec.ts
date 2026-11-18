import { QualitySnapshot, ratingCoverage } from './quality-report.types';
import { formatQualityReport, qualityAlerts } from './quality-report.format';

const snapshot = (overrides: Partial<QualitySnapshot> = {}): QualitySnapshot => ({
  period: { from: '2026-10-27', to: '2026-10-28' },
  ratings: {
    count: 40,
    average: 4.8,
    low: 1,
    completedRides: 100,
    lowPassengerRatings: 0,
    lowList: [],
  },
  driversAtRisk: [],
  support: { openedInPeriod: 3, medianFirstResponseMin: 12, openNow: 1, unanswered: 0, oldestUnansweredHours: null },
  sos: { inPeriod: 0, active: 0, oldestActiveMinutes: null },
  lostItems: { reportedInPeriod: 0, open: 0, oldestOpenHours: null },
  ...overrides,
});

describe('ratingCoverage', () => {
  it('is rated rides / completed rides in percent', () => {
    expect(ratingCoverage(snapshot())).toBe(40);
  });
});

describe('qualityAlerts', () => {
  it('is quiet on a good day', () => {
    expect(qualityAlerts(snapshot())).toEqual([]);
  });

  it('puts an active SOS first, whatever else is going on', () => {
    const alerts = qualityAlerts(
      snapshot({
        sos: { inPeriod: 1, active: 1, oldestActiveMinutes: 95 },
        support: { ...snapshot().support, unanswered: 2, oldestUnansweredHours: 6 },
      }),
    );
    expect(alerts[0]).toContain('SOS');
    expect(alerts[0]).toContain('95 daqiqa');
  });

  it('flags support waiting too long and a stale lost item', () => {
    const alerts = qualityAlerts(
      snapshot({
        support: { ...snapshot().support, unanswered: 2, oldestUnansweredHours: 6 },
        lostItems: { reportedInPeriod: 1, open: 1, oldestOpenHours: 30 },
      }),
    );
    expect(alerts.some((a) => a.includes('2 ta murojaat') && a.includes('6 soat'))).toBe(true);
    expect(alerts.some((a) => a.includes('buyum') && a.includes('30 soat'))).toBe(true);
  });

  it('a fresh unanswered message is not an alert yet', () => {
    expect(
      qualityAlerts(snapshot({ support: { ...snapshot().support, unanswered: 1, oldestUnansweredHours: 1 } })),
    ).toEqual([]);
  });

  it('flags a low average only with enough ratings, and drivers at risk', () => {
    const lowAvg = (count: number) =>
      snapshot({ ratings: { ...snapshot().ratings, count, average: 4.2 } });
    expect(qualityAlerts(lowAvg(15)).some((a) => a.includes("o'rtacha baho 4.2"))).toBe(true);
    expect(qualityAlerts(lowAvg(3)).some((a) => a.includes("o'rtacha baho"))).toBe(false);

    const risk = snapshot({
      driversAtRisk: [{ driverUserId: 'd', name: 'Ali', phone: '', recentAvg: 4.1, recentCount: 12 }],
    });
    expect(qualityAlerts(risk).some((a) => a.includes('1 ta haydovchi'))).toBe(true);
  });

  it('flags several low ratings in one period', () => {
    const s = snapshot({ ratings: { ...snapshot().ratings, low: 3 } });
    expect(qualityAlerts(s).some((a) => a.includes('3 ta past baho'))).toBe(true);
  });
});

describe('formatQualityReport', () => {
  it('shows ratings, support and low-rating comments, never phones', () => {
    const text = formatQualityReport(
      'Sifat — 27.10.2026',
      snapshot({
        ratings: {
          ...snapshot().ratings,
          lowList: [
            {
              orderId: 'o1',
              driverUserId: 'd1',
              driverName: 'Bobur N.',
              score: 2,
              comment: 'Qo\'pol gapirdi <script>',
              createdAt: '2026-10-27 18:40',
            },
          ],
        },
        driversAtRisk: [{ driverUserId: 'd', name: 'Ali', phone: '+998901234567', recentAvg: 4.1, recentCount: 12 }],
      }),
    );

    expect(text).toContain('Sifat — 27.10.2026');
    expect(text).toContain("O'rtacha baho: 4.8");
    expect(text).toContain('40% safarga baho');
    expect(text).toContain('Bobur N. — 2★');
    expect(text).toContain('&lt;script&gt;');
    expect(text).toContain('12 daqiqa');
    expect(text).not.toContain('+998');
  });
});
