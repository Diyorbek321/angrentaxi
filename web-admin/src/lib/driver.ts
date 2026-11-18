import type { Driver } from './api';

/**
 * When the driver registered. The API's driver payload carries no top-level
 * `createdAt` (the profile entity has none) — the date is the account's,
 * on the embedded `user`. Falls back to a top-level value should the backend
 * ever add one. Returns null when neither is present.
 */
export function driverRegisteredAt(d: Pick<Driver, 'createdAt' | 'user'>): string | null {
  return d.createdAt ?? d.user?.createdAt ?? null;
}
