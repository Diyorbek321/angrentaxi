import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AnalyticsApp,
  APP_FUNNEL_STEPS,
  AppFunnelStep,
  MAX_FUNNEL_RANGE_DAYS,
  SERVER_FUNNEL_STEPS,
  ServerFunnelStep,
} from './analytics.constants';

export type FunnelStep = AppFunnelStep | ServerFunnelStep;

export interface FunnelReport {
  /** Butun oraliq bo'yicha jami, voronka tartibida. */
  steps: Array<{ step: FunnelStep; source: 'app' | 'server'; count: number }>;
  /** Kunlik kesim; nol bosqichlar yozilmaydi. */
  days: Array<{ day: string } & Partial<Record<FunnelStep, number>>>;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Anonim ilova voronkasi: ilova bosqichlari kunlik hisoblagichda
 * (`app_funnel_daily`), zakazdan keyingi bosqichlar — `orders` jadvalidan.
 * Foydalanuvchi yoki qurilma bo'yicha hech narsa saqlanmaydi.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Har bosqich +1 (atomar). Xato faqat log: analytics yiqilsa ham ilovaning
   * so'rovi muvaffaqiyatli qaytsin.
   */
  async record(app: AnalyticsApp, steps: readonly AppFunnelStep[]): Promise<void> {
    const unique = [...new Set(steps)];
    if (unique.length === 0) return;

    await this.dataSource
      .query(
        `INSERT INTO app_funnel_daily (day, app, step, count)
         SELECT (now() AT TIME ZONE 'Asia/Tashkent')::date, $1, s, 1
           FROM unnest($2::varchar[]) AS s
         ON CONFLICT (day, app, step) DO UPDATE SET
           count = app_funnel_daily.count + 1`,
        [app, unique],
      )
      .catch((err: Error) => this.logger.warn(`Voronka hisobi yozilmadi: ${err.message}`));
  }

  async getFunnel(from: string, to: string): Promise<FunnelReport> {
    this.assertRange(from, to);

    const [appRows, orderRows] = await Promise.all([
      this.dataSource.query(
        `SELECT to_char(day, 'YYYY-MM-DD') AS day, step, SUM(count)::int AS count
           FROM app_funnel_daily
          WHERE app = 'passenger' AND day BETWEEN $1 AND $2
          GROUP BY day, step
          ORDER BY day`,
        [from, to],
      ) as Promise<Array<{ day: string; step: AppFunnelStep; count: number }>>,
      // Backend TZ=Asia/Tashkent: `created_at` mahalliy vaqt, DATE() — Toshkent kuni
      // (orders-stats.service hisobotlari bilan bir xil).
      this.dataSource.query(
        `SELECT to_char(DATE(created_at), 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS created,
                COUNT(driver_id)::int AS assigned,
                (COUNT(*) FILTER (WHERE status = 'completed'))::int AS completed
           FROM orders
          WHERE service_type = 'taxi'
            AND DATE(created_at) BETWEEN $1 AND $2
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at)`,
        [from, to],
      ) as Promise<Array<{ day: string; created: number; assigned: number; completed: number }>>,
    ]);

    const byDay = new Map<string, { day: string } & Partial<Record<FunnelStep, number>>>();
    const totals = new Map<FunnelStep, number>();
    const add = (day: string, step: FunnelStep, count: number): void => {
      if (!count) return;
      const row = byDay.get(day) ?? { day };
      byDay.set(day, { ...row, [step]: (row[step] ?? 0) + count });
      totals.set(step, (totals.get(step) ?? 0) + count);
    };

    for (const r of appRows) {
      if ((APP_FUNNEL_STEPS as readonly string[]).includes(r.step)) add(r.day, r.step, r.count);
    }
    for (const r of orderRows) {
      add(r.day, 'order_created', r.created);
      add(r.day, 'driver_assigned', r.assigned);
      add(r.day, 'trip_completed', r.completed);
    }

    return {
      steps: [
        ...APP_FUNNEL_STEPS.map((step) => ({ step, source: 'app' as const, count: totals.get(step) ?? 0 })),
        ...SERVER_FUNNEL_STEPS.map((step) => ({ step, source: 'server' as const, count: totals.get(step) ?? 0 })),
      ],
      days: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    };
  }

  private assertRange(from: string, to: string): void {
    const fromMs = DATE_RE.test(from) ? Date.parse(`${from}T00:00:00Z`) : NaN;
    const toMs = DATE_RE.test(to) ? Date.parse(`${to}T00:00:00Z`) : NaN;
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      throw new BadRequestException('"from" va "to" — YYYY-MM-DD sana');
    }
    if (toMs < fromMs) throw new BadRequestException('"to" "from" dan oldin bo\'lmasin');
    if ((toMs - fromMs) / MS_PER_DAY + 1 > MAX_FUNNEL_RANGE_DAYS) {
      throw new BadRequestException(`Oraliq ${MAX_FUNNEL_RANGE_DAYS} kundan oshmasin`);
    }
  }
}
