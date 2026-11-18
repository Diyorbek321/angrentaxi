export const PARTNER_BUSINESS_TYPES = ['restaurant', 'store', 'pharmacy', 'other'] as const;
export const COURIER_VEHICLES = ['foot', 'bike', 'moto', 'car'] as const;

/** Bir raqam bir turga 24 soatda bir marta — qayta yuborish jim qabul qilinadi. */
export const LEAD_DUPLICATE_WINDOW_HOURS = 24;

/** Bitta IP: 10 daqiqada 3 ta, sutkada 10 ta ariza. */
export const LEAD_THROTTLE = {
  medium: { limit: 3, ttl: 600_000 },
  long: { limit: 10, ttl: 86_400_000 },
};

/** O'zbekiston mobil raqami: bo'sh joy, chiziqcha, qavslar olib tashlanadi. */
export function normalizeUzPhone(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const digits = raw.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if (/^\d{9}$/.test(digits)) return `+998${digits}`;
  if (/^998\d{9}$/.test(digits)) return `+${digits}`;
  return raw.trim();
}
