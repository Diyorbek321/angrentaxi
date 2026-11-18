/**
 * Sotuvchi bilan hisob-kitob rejimi (ovqat/market naqd buyurtmasi).
 *
 * Huquqiy asos: e-tijorat qonuniga o'zgartishlar (imzolangan 10.09.2026,
 * kuchga kirishi **2026-12-12**), 23-modda — kuryer mijozdan olingan naqd
 * pulni faqat sotuvchiga oldindan ELEKTRON o'tkazgan summasi doirasida
 * ushlab qola oladi. Bugungi oqim (kuryer do'konga naqd to'laydi,
 * `vendor-cash.ts`) shu sanadan keyin ruxsat etilmaydi.
 *
 *  · `cash`   — bugungi xulq: kuryer do'konga naqd to'laydi, sotuvchi
 *               "oldim/olmadim" deydi.
 *  · `wallet` — olib ketishda kuryer hamyonidan sotuvchi hisobiga o'tkazma;
 *               sotuvchi tasdig'i kerak emas. Mijozdan naqd baribir olinadi.
 *
 * Amaldagi rejim = `wallet`, agar admin uni yoqqan bo'lsa YOKI
 * `vendorWalletSettlementFrom` sanasi kelgan bo'lsa; aks holda `cash`.
 */
export type VendorSettlementMode = 'cash' | 'wallet';

export const VENDOR_SETTLEMENT_MODES: readonly VendorSettlementMode[] = ['cash', 'wallet'];

/** 2026-12-12 00:00 Toshkent vaqti (UTC+5). */
export const DEFAULT_VENDOR_WALLET_SETTLEMENT_FROM = new Date('2026-12-12T00:00:00+05:00');

export function isVendorSettlementMode(value: unknown): value is VendorSettlementMode {
  return typeof value === 'string' && (VENDOR_SETTLEMENT_MODES as readonly string[]).includes(value);
}

export function effectiveVendorSettlementMode(
  configured: string,
  walletFrom: Date | null,
  now: Date,
): VendorSettlementMode {
  if (configured === 'wallet') return 'wallet';
  if (walletFrom != null && now.getTime() >= walletFrom.getTime()) return 'wallet';
  return 'cash';
}
