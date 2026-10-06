import { describe, expect, it } from 'vitest';
import type { PendingVerification } from './api';
import { groupVerifications } from './verification';

const entry = (over: Partial<PendingVerification>): PendingVerification => ({
  id: 'x',
  driverId: 'd1',
  driverName: 'Bobur',
  driverPhone: '+998901234572',
  code: 'vehicle_photo_front',
  label: 'Old',
  kind: 'vehicle_photo',
  submittedAt: '2026-10-06T10:00:00Z',
  referenceSubmissionId: null,
  ...over,
});

describe('groupVerifications', () => {
  it('bitta haydovchining 7 ta koʻrik surati bitta guruh boʻladi', () => {
    const groups = groupVerifications([
      entry({ id: 'a', code: 'vehicle_photo_front' }),
      entry({ id: 'b', code: 'vehicle_photo_trunk' }),
      entry({ id: 's', code: 'selfie', kind: 'selfie' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.kind === 'vehicle_photo')?.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('eng eski guruh birinchi', () => {
    const groups = groupVerifications([
      entry({ id: 'new', driverId: 'd1', submittedAt: '2026-10-06T12:00:00Z' }),
      entry({ id: 'old', driverId: 'd2', submittedAt: '2026-10-05T09:00:00Z' }),
    ]);
    expect(groups.map((g) => g.driverId)).toEqual(['d2', 'd1']);
  });
});
