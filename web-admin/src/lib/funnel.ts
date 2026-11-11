/** Backend `GET /analytics/funnel` (AnalyticsService.getFunnel). */
export type FunnelStepKey =
  | 'app_open'
  | 'destination_selected'
  | 'price_shown'
  | 'order_requested'
  | 'order_created'
  | 'driver_assigned'
  | 'trip_completed';

export interface FunnelReport {
  steps: Array<{ step: FunnelStepKey; source: 'app' | 'server'; count: number }>;
  days: Array<{ day: string } & Partial<Record<FunnelStepKey, number>>>;
}

export interface FunnelRow {
  step: FunnelStepKey;
  source: 'app' | 'server';
  count: number;
  /** Ustun eni: voronka boshiga (eng katta qiymatga) nisbatan, 0–100. */
  widthPct: number;
  /** Oldingi bosqichdan o'tish, %. Oldingisi 0 — `null` (ma'nosiz, o'ylab topilmaydi). */
  fromPrevPct: number | null;
}

/**
 * Voronka qatorlari. Ilova va server bosqichlari bitta zanjir: zakaz berildi
 * (ilova) → yaratildi (server). Ular har doim teng emas (dispetcher zakazi,
 * eski ilova versiyasi), shuning uchun o'tish 100% dan oshishi mumkin —
 * yashirilmaydi, ko'rsatiladi.
 */
export function funnelRows(report: FunnelReport): FunnelRow[] {
  const max = Math.max(0, ...report.steps.map((s) => s.count));
  return report.steps.map((s, i) => {
    const prev = i > 0 ? report.steps[i - 1].count : null;
    return {
      ...s,
      widthPct: max > 0 ? Math.round((s.count / max) * 100) : 0,
      fromPrevPct: prev == null || prev === 0 ? null : Math.round((s.count / prev) * 100),
    };
  });
}

/** Ilova bosqichlari umuman kelmagan — ilovaning voronkali versiyasi hali o'rnatilmagan. */
export function hasAppData(report: FunnelReport): boolean {
  return report.steps.some((s) => s.source === 'app' && s.count > 0);
}
