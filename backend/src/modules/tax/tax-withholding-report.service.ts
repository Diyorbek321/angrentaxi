import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import {
  TAX_WITHHOLDING_LEDGER_TAG,
  TaxReportRow,
  parseReportMonth,
  toTaxReportCsv,
} from './tax-withholding';

/** Hisobotdagi bitta haydovchi/kuryer. */
export interface TaxReportEntry extends TaxReportRow {
  /** Karta puli hali yig'ilmagan safarlar bo'yicha ushlab qolinadigan summa. */
  pendingWithheldAmount: number;
}

export interface TaxReportTotals {
  grossIncome: number;
  withheldAmount: number;
  pendingWithheldAmount: number;
  orderCount: number;
}

export interface TaxWithholdingReport {
  month: string;
  from: string;
  to: string;
  rows: TaxReportEntry[];
  totals: TaxReportTotals;
}

interface RawReportRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  pinfl: string | null;
  tin: string | null;
  tax_status: string | null;
  gross_income: string | number;
  withheld_amount: string | number;
  pending_withheld_amount: string | number;
  order_count: string | number;
}

/** Soliq bazasi — chegirmagacha yo'l haqi (taksi promosini platforma to'laydi, §26a). */
export const TAX_REPORT_GROSS_SQL = 'o.final_price + COALESCE(o.discount_amount, 0)';

/**
 * Oyma-oy: har bir haydovchi/kuryer bo'yicha yalpi daromad (komissiya bilan
 * bir xil baza — chegirmagacha yo'l haqi, `TAX_REPORT_GROSS_SQL`), ushlab qolingan soliq va buyurtmalar
 * soni. Oy — `completed_at` bo'yicha, Toshkent kalendari.
 *
 * Soliq qatori bitta buyurtmaga ko'pi bilan bitta (unikal indeks), shuning
 * uchun LEFT JOIN yalpi daromadni ko'paytirib yubormaydi. REFUNDED qator
 * ushlab qolingan hisoblanmaydi.
 */
const REPORT_SQL = `
  SELECT o.driver_id                                   AS user_id,
         u.first_name, u.last_name, u.phone,
         d.pinfl, d.tin, d.tax_status,
         COALESCE(SUM(${TAX_REPORT_GROSS_SQL}), 0) AS gross_income,
         COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'completed'), 0) AS withheld_amount,
         COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'pending'), 0)   AS pending_withheld_amount,
         COUNT(o.id)                                   AS order_count
    FROM orders o
    JOIN users u ON u.id = o.driver_id
    LEFT JOIN drivers d ON d.user_id = o.driver_id
    LEFT JOIN transactions t
           ON t.order_id = o.id
          AND t.user_id = o.driver_id
          AND t.external_id = '${TAX_WITHHOLDING_LEDGER_TAG}'
   WHERE o.status = 'completed'
     AND o.driver_id IS NOT NULL
     AND o.completed_at >= $1
     AND o.completed_at < $2
   GROUP BY o.driver_id, u.first_name, u.last_name, u.phone, d.pinfl, d.tin, d.tax_status
   ORDER BY withheld_amount DESC, gross_income DESC`;

function toEntry(raw: RawReportRow): TaxReportEntry {
  const name = [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim();
  return {
    userId: raw.user_id,
    name: name || null,
    phone: raw.phone,
    pinfl: raw.pinfl,
    tin: raw.tin,
    taxStatus: raw.tax_status,
    grossIncome: Number(raw.gross_income),
    withheldAmount: Number(raw.withheld_amount),
    pendingWithheldAmount: Number(raw.pending_withheld_amount),
    orderCount: Number(raw.order_count),
  };
}

function sumTotals(rows: readonly TaxReportEntry[]): TaxReportTotals {
  return rows.reduce<TaxReportTotals>(
    (acc, row) => ({
      grossIncome: acc.grossIncome + row.grossIncome,
      withheldAmount: acc.withheldAmount + row.withheldAmount,
      pendingWithheldAmount: acc.pendingWithheldAmount + row.pendingWithheldAmount,
      orderCount: acc.orderCount + row.orderCount,
    }),
    { grossIncome: 0, withheldAmount: 0, pendingWithheldAmount: 0, orderCount: 0 },
  );
}

@Injectable()
export class TaxWithholdingReportService {
  constructor(@InjectRepository(Order) private readonly orderRepository: Repository<Order>) {}

  async getMonthlyReport(month: string): Promise<TaxWithholdingReport> {
    const range = parseReportMonth(month);
    if (!range) {
      throw new BadRequestException('month YYYY-MM formatida bo‘lishi kerak');
    }
    const raw = (await this.orderRepository.query(REPORT_SQL, [range.from, range.to])) as RawReportRow[];
    const rows = raw.map(toEntry);
    return {
      month,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      rows,
      totals: sumTotals(rows),
    };
  }

  async getMonthlyReportCsv(month: string): Promise<string> {
    const { rows } = await this.getMonthlyReport(month);
    return toTaxReportCsv(rows);
  }
}
