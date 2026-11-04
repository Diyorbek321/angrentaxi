/**
 * Postgres sessiyasi timezone'i Node jarayoni bilan BIR XIL bo'lishi shart.
 *
 * 74 ta ustun `timestamp` (timezone'siz). pg drayveri JS `Date` ni Node
 * vaqtida yozadi va o'qiydi, `DEFAULT now()` / `CURRENT_TIMESTAMP` esa sessiya
 * vaqtida yozadi. Prod'da Node `Asia/Tashkent`, Postgres UTC edi: yangi qator
 * 5 soat eski bo'lib o'qilar, `createdAt < cutoff` bilan ishlaydigan har bir
 * muddat (karta to'lovi, hamyon to'ldirish) birinchi tekshiruvdayoq tugardi.
 *
 * Ikkala soat tenglashgach `timestamp` ustunlarda doim Node (Toshkent) vaqti
 * turadi — `report-sql.ts` va `analytics.service.ts` shunga tayanadi.
 */
export function dbSessionTimezoneExtra(
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
): { options: string } {
  return { options: `-c timezone=${timeZone}` };
}
