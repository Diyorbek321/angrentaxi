import { describe, expect, it } from 'vitest';
import { driverRegisteredAt } from './driver';

describe('driverRegisteredAt', () => {
  it('reads the embedded user registration date (shape the API returns)', () => {
    expect(driverRegisteredAt({ user: { createdAt: '2026-07-05T08:16:03.354Z' } })).toBe('2026-07-05T08:16:03.354Z');
  });
  it('prefers a top-level createdAt if present', () => {
    expect(driverRegisteredAt({ createdAt: '2026-01-01T00:00:00Z', user: { createdAt: '2026-07-05T00:00:00Z' } })).toBe(
      '2026-01-01T00:00:00Z'
    );
  });
  it('returns null when missing', () => {
    expect(driverRegisteredAt({})).toBeNull();
    expect(driverRegisteredAt({ user: null })).toBeNull();
  });
});
