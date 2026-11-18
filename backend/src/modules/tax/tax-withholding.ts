/**
 * Soliq agenti sifatida ushlab qolish — sof hisob-kitob (PQ-247, Soliq
 * kodeksi 465/470-moddalar, 2026).
 *
 * Platforma (yuridik shaxs) o'zini o'zi band qilgan haydovchi/kuryer va yillik
 * aylanmasi 1 mlrd so'mgacha YaTT daromadidan 1% aylanma solig'ini ushlab
 * qoladi va har bir shaxs bo'yicha hisobot beradi.
 *
 * DAROMAD BAZASI = komissiya bilan BIR XIL baza: CHEGIRMAGACHA yo'l haqi
 * (`fare_breakdown.total`; promo chegirmasini platforma qoplaydi — §26a,
 * `orders.final_price + orders.discount_amount`). Sabab: komissioner
 * modelida haydovchi (komitent) butun summani mijozdan oladi, platforma
 * komissiyasi — uning xarajati, aylanmani kamaytirmaydi. Chaqiriq (tip)
 * bazaga KIRMAYDI — u alohida oqim (`orders-tips.service.ts`).
 */

/** Daftar qatori belgisi (`transactions.external_id`), komissiyadagi `'commission'` kabi. */
export const TAX_WITHHOLDING_LEDGER_TAG = 'tax_withholding';

export interface TaxWithholdingPolicy {
  enabled: boolean;
  /** Foiz, masalan 1.0 = 1%. */
  ratePercent: number;
}

export function computeTaxWithholding(income: number, policy: TaxWithholdingPolicy): number {
  if (!policy.enabled || income <= 0 || policy.ratePercent <= 0) {
    return 0;
  }
  return Math.round((income * policy.ratePercent) / 100);
}

/** Toshkent vaqti UTC+5, yozgi vaqt yo'q. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * `YYYY-MM` → [from, to) — Toshkent kalendari bo'yicha oy, UTC lahzalarda.
 * Noto'g'ri format — `null` (chaqiruvchi 400 qaytaradi).
 */
export function parseReportMonth(month: string): { from: Date; to: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return {
    from: new Date(Date.UTC(year, monthIndex, 1) - TASHKENT_OFFSET_MS),
    to: new Date(Date.UTC(year, monthIndex + 1, 1) - TASHKENT_OFFSET_MS),
  };
}

export interface TaxReportRow {
  userId: string;
  name: string | null;
  phone: string | null;
  pinfl: string | null;
  tin: string | null;
  taxStatus: string | null;
  grossIncome: number;
  withheldAmount: number;
  orderCount: number;
  /** Karta puli hali yig'ilmagan safarlar bo'yicha ushlab qolinadigan summa (JSON bilan bir xil). */
  pendingWithheldAmount?: number;
}

const CSV_COLUMNS: ReadonlyArray<[string, keyof TaxReportRow]> = [
  ['user_id', 'userId'],
  ['name', 'name'],
  ['phone', 'phone'],
  ['pinfl', 'pinfl'],
  ['tin', 'tin'],
  ['tax_status', 'taxStatus'],
  ['gross_income', 'grossIncome'],
  ['withheld_amount', 'withheldAmount'],
  ['order_count', 'orderCount'],
  // Oxirida — ustun tartibiga tayangan mavjud importlar buzilmasin.
  ['pending_withheld_amount', 'pendingWithheldAmount'],
];

/**
 * CSV maydoni. Ism foydalanuvchi kiritgan matn — Excel'da `=`, `+`, `-`, `@`
 * bilan boshlangan qiymat formula bo'lib ishlaydi, shuning uchun `'` bilan
 * neytrallanadi. Telefon (`+998...`) va raqamlar bunga tushmasligi uchun
 * faqat `name` tozalanadi.
 */
function csvField(value: string | number | null | undefined, isFreeText: boolean): string {
  if (value === undefined) return '0';
  if (value === null) return '';
  let text = String(value);
  if (isFreeText && /^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\n\r]/.test(text) || (isFreeText && text.startsWith("'"))
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function toTaxReportCsv(rows: readonly TaxReportRow[]): string {
  const header = CSV_COLUMNS.map(([column]) => column).join(',');
  const lines = rows.map((row) =>
    CSV_COLUMNS.map(([, key]) => csvField(row[key], key === 'name')).join(','),
  );
  return [header, ...lines].join('\n');
}
