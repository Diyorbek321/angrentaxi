import { Driver } from '../../database/entities/driver.entity';

/**
 * Menejer/admin ro'yxat va kartochka javoblaridan chiqarib tashlanadigan
 * shaxsiy ma'lumotlar (security review #2). To'liq qiymatlar faqat
 * `GET /drivers/:id/legal` da (DRIVERS_APPROVE'siz — niqoblangan) va admin
 * soliq hisobotida (`/admin/tax-withholding/report[.csv]` — deklaratsiya uchun).
 */
export const DRIVER_PII_FIELDS = ['pinfl', 'tin', 'birthDate'] as const;

export type DriverPublicView<T extends Partial<Driver>> = Omit<T, (typeof DRIVER_PII_FIELDS)[number]>;

/** Yangi obyekt qaytaradi (asl entity o'zgarmaydi). */
export function toDriverPublicView<T extends Partial<Driver>>(driver: T): DriverPublicView<T>;
export function toDriverPublicView<T extends Partial<Driver>>(driver: T | null): DriverPublicView<T> | null;
export function toDriverPublicView<T extends Partial<Driver>>(driver: T | null): DriverPublicView<T> | null {
  if (!driver) return null;
  const { pinfl: _pinfl, tin: _tin, birthDate: _birthDate, ...rest } = driver;
  return rest;
}
