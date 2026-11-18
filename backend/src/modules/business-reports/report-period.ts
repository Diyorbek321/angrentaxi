/** Toshkent UTC+5, yozgi vaqt yo'q. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Tashkent mahalliy sanalari, `to` kirmaydi: [from, to). */
export interface ReportPeriod {
  from: string;
  to: string;
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function tashkentToday(now: Date = new Date()): string {
  return new Date(now.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

export function yesterday(now: Date = new Date()): ReportPeriod {
  const today = tashkentToday(now);
  return { from: addDays(today, -1), to: today };
}

/** Joriy haftadan oldingi to'liq hafta (dushanba–yakshanba). */
export function previousWeek(now: Date = new Date()): ReportPeriod {
  const today = tashkentToday(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = yakshanba
  const thisMonday = addDays(today, -((weekday + 6) % 7));
  return { from: addDays(thisMonday, -7), to: thisMonday };
}

export function periodDays(period: ReportPeriod): number {
  return Math.round((Date.parse(period.to) - Date.parse(period.from)) / DAY_MS);
}
