import { IntercityTripStatus } from '../../database/entities/intercity-trip.entity';
import { redactUnrevealedDriverPhone } from './intercity-contact-redaction';

const NOW = new Date('2026-10-20T03:00:00.000Z');
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3_600_000);
const order = (overrides: Record<string, unknown> = {}) => ({
  id: 'o1',
  intercityTripId: 'trip-1',
  driver: { id: 'driver-user', firstName: 'Ali', phone: '+998901112233' },
  ...overrides,
});

describe('redactUnrevealedDriverPhone', () => {
  it("jo'nashga 4 soat — telefon yashiriladi, asl obyekt O'ZGARMAYDI", () => {
    const original = order();
    const result = redactUnrevealedDriverPhone(original, { status: IntercityTripStatus.OPEN, departureAt: hoursAhead(4) }, NOW);

    expect(result.driver?.phone).toBeNull();
    expect(result.driver?.firstName).toBe('Ali');
    expect(original.driver.phone).toBe('+998901112233');
  });

  it("jo'nashga 30 daqiqa — telefon ochiq", () => {
    const result = redactUnrevealedDriverPhone(order(), { status: IntercityTripStatus.OPEN, departureAt: hoursAhead(0.5) }, NOW);
    expect(result.driver?.phone).toBe('+998901112233');
  });

  it("yig'ish boshlangan — ochiq", () => {
    const result = redactUnrevealedDriverPhone(order(), { status: IntercityTripStatus.BOARDING, departureAt: hoursAhead(5) }, NOW);
    expect(result.driver?.phone).toBe('+998901112233');
  });

  it("qatnov topilmadi — xavfsiz tomonga: yashiriladi", () => {
    expect(redactUnrevealedDriverPhone(order(), undefined, NOW).driver?.phone).toBeNull();
  });

  it("taksi buyurtmasi — tegilmaydi (regressiya)", () => {
    const taxi = order({ intercityTripId: null });
    expect(redactUnrevealedDriverPhone(taxi, undefined, NOW)).toBe(taxi);
  });

  it("haydovchi yuklanmagan — o'zgarishsiz", () => {
    const noDriver = order({ driver: null });
    expect(redactUnrevealedDriverPhone(noDriver, undefined, NOW)).toBe(noDriver);
  });
});
