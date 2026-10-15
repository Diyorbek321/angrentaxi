/**
 * Sotuvchi STIR'i (INN) — 9 raqam, fiskal chekda komitent sifatida yoziladi
 * (docs/LEGAL-COMPLIANCE.md §3). Backend DTO bilan bir xil qoida: `^\d{9}$`.
 * Bo'sh qiymat — ixtiyoriy maydon, xato emas.
 */
export const TIN_LENGTH = 9;

export function tinError(value: string): string | null {
  const v = value.trim();
  if (v === '') return null;
  if (!/^\d+$/.test(v)) return 'Faqat raqamlar';
  if (v.length !== TIN_LENGTH) return `STIR ${TIN_LENGTH} ta raqamdan iborat boʻlishi kerak (${v.length}/${TIN_LENGTH})`;
  return null;
}
