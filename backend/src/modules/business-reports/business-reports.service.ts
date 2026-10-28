import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FinanceReportService } from './finance-report.service';
import { TelegramService } from './telegram.service';
import { SupplyReportService } from './supply-report.service';
import { SupplySnapshot } from './supply-report.types';
import { formatSupplyReport, supplyAlerts } from './supply-report.format';
import { FinanceSnapshot, netRevenue } from './finance-report.types';
import { financeAlerts, formatFinanceReport } from './finance-report.format';
import { ReportPeriod, addDays, periodDays, previousWeek, yesterday } from './report-period';

export interface FinanceReport {
  snapshot: FinanceSnapshot;
  /** Oldingi davrlarning o'rtachasi (shu uzunlikda). */
  baseline: FinanceSnapshot;
  netRevenue: number;
  alerts: string[];
}

export interface SupplyReport {
  snapshot: SupplySnapshot;
  alerts: string[];
}

/** Kunlik hisobot oldingi 7 kun bilan, uzunroq davr — oldingi 4 davr bilan solishtiriladi. */
const baselineSamples = (period: ReportPeriod): number => (periodDays(period) === 1 ? 7 : 4);

/** `2026-10-27` → `27.10.2026` */
const dmy = (date: string): string => date.split('-').reverse().join('.');

/**
 * Egasiga avtomatik moliya hisobotlari (Telegram). Kunlik — har kuni 08:00,
 * haftalik — dushanba 08:05 (Toshkent). Telegram sozlanmagan bo'lsa jim
 * o'tadi (`TelegramService`), so'rov xatosi esa Telegram'ga yoziladi —
 * hisobot kelmay qolsa egasi buni bilishi kerak.
 */
@Injectable()
export class BusinessReportsService {
  private readonly logger = new Logger(BusinessReportsService.name);

  constructor(
    private readonly finance: FinanceReportService,
    private readonly supply: SupplyReportService,
    private readonly telegram: TelegramService,
  ) {}

  async report(period: ReportPeriod): Promise<FinanceReport> {
    const [snapshot, baseline] = await Promise.all([
      this.finance.snapshot(period),
      this.finance.baseline(period, baselineSamples(period)),
    ]);
    return { snapshot, baseline, netRevenue: netRevenue(snapshot), alerts: financeAlerts(snapshot, baseline) };
  }

  async supplyReport(period: ReportPeriod): Promise<SupplyReport> {
    const snapshot = await this.supply.snapshot(period);
    return { snapshot, alerts: supplyAlerts(snapshot) };
  }

  @Cron('0 8 * * *', { name: 'business-report-daily', timeZone: 'Asia/Tashkent' })
  async dailyCron(): Promise<void> {
    await this.sendDaily();
  }

  @Cron('5 8 * * 1', { name: 'business-report-weekly', timeZone: 'Asia/Tashkent' })
  async weeklyCron(): Promise<void> {
    await this.sendWeekly();
  }

  /** Moliya, keyin haydovchilar bo'limi — ikki alohida xabar. */
  async sendDaily(now: Date = new Date()): Promise<boolean> {
    const period = yesterday(now);
    const day = dmy(period.from);
    return this.sendAll(period, `Kunlik hisobot — ${day}`, `Haydovchilar bo'limi — ${day}`);
  }

  async sendWeekly(now: Date = new Date()): Promise<boolean> {
    const period = previousWeek(now);
    const range = `${dmy(period.from).slice(0, 5)}–${dmy(addDays(period.to, -1))}`;
    return this.sendAll(period, `Haftalik hisobot — ${range}`, `Haydovchilar bo'limi — ${range}`);
  }

  private async sendAll(period: ReportPeriod, financeTitle: string, supplyTitle: string): Promise<boolean> {
    const finance = await this.send(financeTitle, async () => {
      const { snapshot, baseline } = await this.report(period);
      return formatFinanceReport(financeTitle, snapshot, baseline);
    });
    const supply = await this.send(supplyTitle, async () =>
      formatSupplyReport(supplyTitle, await this.supply.snapshot(period)),
    );
    return finance && supply;
  }

  /** Bitta bo'lim xatosi boshqasini to'xtatmaydi; xato Telegram'ga yoziladi. */
  private async send(title: string, build: () => Promise<string>): Promise<boolean> {
    try {
      return await this.telegram.send(await build());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${title} failed: ${message}`);
      await this.telegram.send(`❌ ${title}ni tuzib bo'lmadi — server jurnalini tekshiring.`);
      return false;
    }
  }
}
