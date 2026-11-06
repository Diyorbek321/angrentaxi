import { isInsidePoint } from './intercity-geo';

describe('intercity-geo — isInsidePoint', () => {
  // Angren markazi, 12 km.
  const angren = { centerLat: 40.0956, centerLng: 70.9432, radiusKm: 12 };

  it('markazning o\'zi — ichida', () => {
    expect(isInsidePoint(angren, 40.0956, 70.9432)).toBe(true);
  });

  it('radius ichidagi nuqta (≈5 km shimolda) — ichida', () => {
    expect(isInsidePoint(angren, 40.1406, 70.9432)).toBe(true);
  });

  it('radiusdan tashqari (Toshkent) — tashqarida', () => {
    expect(isInsidePoint(angren, 41.3111, 69.2797)).toBe(false);
  });

  it('chegaradan bir oz tashqarida (≈12.2 km) — tashqarida', () => {
    // 1° kenglik ≈ 111.2 km → 0.11° ≈ 12.23 km.
    expect(isInsidePoint(angren, 40.0956 + 0.11, 70.9432)).toBe(false);
  });

  it('noto\'g\'ri koordinata (NaN) — tashqarida, istisno otmaydi', () => {
    expect(isInsidePoint(angren, Number.NaN, 70.9432)).toBe(false);
  });
});
