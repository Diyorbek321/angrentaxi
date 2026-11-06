/**
 * Sotuvchi buyurtmasi JSON'idagi `vendorWalletSettlement` (docs §22).
 *
 * Summalar o'tkazma PAYTIDA buyurtmaga yoziladi (`vendor_wallet_amount`,
 * `vendor_wallet_commission`) — joriy komissiya stavkasidan qayta
 * hisoblanmaydi. Teskari o'tkazma `vendor_wallet_reversed_at` bilan ko'rinadi:
 *   · `settledAt != null` — hozir hamyon orqali hisoblangan;
 *   · `settledAt == null && reversedAt != null` — teskari qilingan, qayta
 *     o'tkazma kutilmoqda (yoki buyurtma bekor);
 *   · ikkalasi bor — teskaridan keyin yangi kuryer qayta o'tkazgan
 *     (`reversalCount` necha marta teskari qilinganini aytadi).
 * Hech qachon o'tkazilmagan buyurtma — `null`.
 */
export interface VendorWalletSettlementView {
  amount: number;
  commission: number;
  net: number;
  settledAt: string | null;
  reversedAt: string | null;
  reversalCount: number;
}

export interface VendorWalletSettlementColumns {
  vendorWalletAmount: number | string | null;
  vendorWalletCommission: number | string | null;
  vendorWalletSettledAt: Date | null;
  vendorWalletReversedAt: Date | null;
  vendorWalletReversalCount: number;
}

const iso = (value: Date | string | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null;

export function vendorWalletSettlementView(
  order: VendorWalletSettlementColumns,
): VendorWalletSettlementView | null {
  if (order.vendorWalletAmount === null || order.vendorWalletAmount === undefined) return null;
  const amount = Number(order.vendorWalletAmount) || 0;
  const commission = Number(order.vendorWalletCommission ?? 0) || 0;
  return {
    amount,
    commission,
    net: amount - commission,
    settledAt: iso(order.vendorWalletSettledAt),
    reversedAt: iso(order.vendorWalletReversedAt),
    reversalCount: order.vendorWalletReversalCount ?? 0,
  };
}
