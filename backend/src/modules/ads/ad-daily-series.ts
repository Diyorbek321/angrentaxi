/** Hisobotning bir kuni. `day` — Toshkent sanasi, `YYYY-MM-DD`. */
export interface AdDailyRow {
  day: string;
  impressions: number;
  clicks: number;
}

export const AD_STATS_MAX_DAYS = 90;

/** [now] ning Toshkent (UTC+5, yozgi vaqtsiz) sanasi. */
export function tashkentDay(now: Date): string {
  return new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Oxirgi [days] kun, eskisidan boshlab; bazada qatori yo'q (jim) kunlar nol
 * bilan to'ldiriladi — grafikda bo'shliq "ma'lumot yo'q" emas, "0" bo'lsin.
 */
export function fillDailySeries(rows: readonly AdDailyRow[], days: number, today: string): AdDailyRow[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(end - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const row = byDay.get(day);
    return { day, impressions: Number(row?.impressions ?? 0), clicks: Number(row?.clicks ?? 0) };
  });
}
