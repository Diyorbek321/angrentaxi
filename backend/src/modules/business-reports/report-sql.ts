/**
 * Hisobot SQL yordamchilari. Davr parametrlari doim `$1` = from, `$2` = to
 * (Toshkent sanalari, `to` kirmaydi).
 *
 * Eski jadvallarda (`orders`, `transactions`, `users`, `food_orders`,
 * `market_orders`, `withdrawal_requests`) ustun `timestamp` — backend
 * TZ=Asia/Tashkent bo'lgani uchun unda Toshkent mahalliy vaqti yoziladi
 * (`analytics.service.ts` bilan bir xil). Yangi jadvallar `timestamptz`.
 */
export const LOCAL = (col: string): string => `${col} >= $1::timestamp AND ${col} < $2::timestamp`;

export const TZ = (col: string): string =>
  `${col} >= ($1::timestamp AT TIME ZONE 'Asia/Tashkent') AND ${col} < ($2::timestamp AT TIME ZONE 'Asia/Tashkent')`;

/** `timestamp` ustunlar bilan solishtirish uchun hozirgi Toshkent vaqti (DB sessiyasi UTC bo'lishi mumkin). */
export const LOCAL_NOW = `(now() AT TIME ZONE 'Asia/Tashkent')`;

/** Yo'lovchi safarlari; ovqat/market kuryer bosqichlari kirmaydi. */
export const RIDE_SERVICE_TYPES = `('taxi', 'cargo', 'parcel', 'intercity')`;

export const SUM = (expr: string, where?: string): string =>
  `COALESCE(SUM(${expr})${where ? ` FILTER (WHERE ${where})` : ''}, 0)::float8`;

/** "Ali V." — familiyadan faqat bosh harf. `alias` — `users` jadvali taxallusi. */
export const PERSON_NAME = (alias: string): string => `COALESCE(NULLIF(TRIM(COALESCE(${alias}.first_name, '') || ' ' ||
  COALESCE(LEFT(${alias}.last_name, 1) || '.', '')), ''), 'Ismsiz')`;
