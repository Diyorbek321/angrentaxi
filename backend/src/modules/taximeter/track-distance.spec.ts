import { cleanTrack, sampleForMatching, trackDistanceKm, type TrackPoint } from './track-distance';

const T0 = new Date('2026-10-06T10:00:00Z').getTime();
// ~111 m per 0.001° latitude.
const at = (sec: number, dLat: number, dLng = 0): TrackPoint => ({
  lat: 41.0 + dLat,
  lng: 70.14 + dLng,
  recordedAt: new Date(T0 + sec * 1000),
});

describe('trackDistanceKm', () => {
  it('sums a straight drive', () => {
    const points = [at(0, 0), at(20, 0.001), at(40, 0.002), at(60, 0.003)];
    expect(trackDistanceKm(points)).toBeCloseTo(0.333, 2);
  });

  it('does not run while the car stands still and GPS wobbles', () => {
    const wobble = Array.from({ length: 60 }, (_, i) =>
      at(i * 5, (i % 2 ? 1 : -1) * 0.00005, (i % 3) * 0.00005),
    );
    expect(trackDistanceKm(wobble)).toBe(0);
  });

  it('drops an impossible jump instead of billing it', () => {
    // 2 km in 5 seconds = 1440 km/h — a bad fix in the middle of a calm drive.
    const points = [at(0, 0), at(20, 0.001), at(25, 0.02), at(40, 0.002)];
    expect(trackDistanceKm(points)).toBeCloseTo(0.222, 2);
  });

  it('orders points by time even if they arrived out of order', () => {
    const points = [at(40, 0.002), at(0, 0), at(20, 0.001)];
    expect(trackDistanceKm(points)).toBeCloseTo(0.222, 2);
  });

  it('is zero without movement data', () => {
    expect(trackDistanceKm([])).toBe(0);
    expect(trackDistanceKm([at(0, 0)])).toBe(0);
  });
});

describe('sampleForMatching', () => {
  it('thins a dense trace but keeps both ends', () => {
    const dense = Array.from({ length: 101 }, (_, i) => at(i * 2, i * 0.0002)); // ~22 m apart
    const sampled = sampleForMatching(dense);
    expect(sampled.length).toBeLessThan(60);
    expect(sampled[0]).toEqual(cleanTrack(dense)[0]);
    expect(sampled[sampled.length - 1]).toEqual(dense[dense.length - 1]);
  });
});
