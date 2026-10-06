import type { PendingVerification, VerificationKind } from './api';

/** One driver's pending submissions of one kind — reviewed together. */
export interface VerificationGroup {
  key: string;
  driverId: string;
  driverName: string | null;
  driverPhone: string | null;
  kind: VerificationKind;
  items: PendingVerification[];
  /** Oldest submission in the group — the queue is worked oldest first. */
  submittedAt: string;
}

/**
 * Groups the flat queue by driver and kind.
 *
 * A vehicle inspection arrives as seven separate photos; reviewing them one
 * row at a time would hide the car as a whole (front fine, trunk full of
 * junk). Grouping shows the whole inspection at once.
 */
export function groupVerifications(entries: PendingVerification[]): VerificationGroup[] {
  const groups = new Map<string, VerificationGroup>();
  for (const entry of entries) {
    const key = `${entry.driverId}:${entry.kind}`;
    const existing = groups.get(key);
    if (existing) {
      groups.set(key, {
        ...existing,
        items: [...existing.items, entry],
        submittedAt: entry.submittedAt < existing.submittedAt ? entry.submittedAt : existing.submittedAt,
      });
    } else {
      groups.set(key, {
        key,
        driverId: entry.driverId,
        driverName: entry.driverName,
        driverPhone: entry.driverPhone,
        kind: entry.kind,
        items: [entry],
        submittedAt: entry.submittedAt,
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

export const KIND_LABEL: Record<VerificationKind, string> = {
  vehicle_photo: 'Mashina koʻrigi',
  selfie: 'Selfi',
  document: 'Hujjat',
};
