/**
 * Naqd buyurtma: kuryer tovar pulini do'konga to'laydi, mijozdan esa yetkazish
 * haqi bilan birga qaytarib oladi (backend `delivery/vendor-cash.ts`).
 *
 * Ikki rejim (`GET /settings/public` → `vendorSettlementMode`,
 * docs/LEGAL-COMPLIANCE.md §7):
 *  - `cash`   — kuryer naqd to'laydi, sotuvchi "oldim" yoki "olmadim" deydi
 *               (ikkinchisi dispetcherga nizo);
 *  - `wallet` — kuryer hamyonidan elektron o'tkazma (olib ketishda). Sotuvchi
 *               hech narsani tasdiqlamaydi — backend bu qadamni 400 bilan rad etadi.
 *
 * Hamyon o'tkazmasi summalari buyurtma JSON'idagi `vendorWalletSettlement`
 * dan olinadi (§22) — o'tkazma PAYTIDA saqlangan; joriy komissiya stavkasidan
 * qayta hisoblanmaydi (stavka keyin o'zgargan bo'lishi mumkin).
 */
export type VendorSettlementMode = 'cash' | 'wallet';

/** Backend `vendorWalletSettlement` (§22). `null` — hech qachon hamyon orqali o'tkazilmagan. */
export interface VendorWalletSettlement {
  amount: number;
  commission: number;
  net: number;
  /** Hozir hisoblangan bo'lsa — o'tkazma payti. */
  settledAt: string | null;
  /** Oxirgi teskari qilingan payt. */
  reversedAt: string | null;
  reversalCount: number;
}

export interface VendorCashFields {
  paymentMethod: 'cash' | 'card';
  items: ReadonlyArray<{ qty: number; price: number }>;
  vendorCashPaidAt?: string | null;
  vendorCashConfirmedAt?: string | null;
  vendorCashDisputedAt?: string | null;
  /** Dispetcher nizoni yopdi (backend migratsiya 020). */
  vendorCashDisputeResolvedAt?: string | null;
  vendorCashDisputeResolution?: string | null;
  /** Kuryer hamyonidan o'tkazildi (migratsiya 026) — eski backend uchun zaxira. */
  vendorWalletSettledAt?: string | null;
  /** O'tkazma summalari va holati (migratsiya 029). */
  vendorWalletSettlement?: VendorWalletSettlement | null;
  /** Kuryer safari — teskaridan keyin yangi kuryer biriktirilganini bilish uchun. */
  delivery?: { status: string } | null;
}

export type VendorCashStep =
  | 'none' // karta — kuryer hech narsa to'lamaydi
  | 'awaiting_courier' // kuryer hali to'lamagan
  | 'awaiting_vendor' // kuryer to'ladim dedi — sotuvchi qarori kerak
  | 'confirmed'
  | 'disputed'
  | 'resolved' // dispetcher nizoni yopdi
  | 'wallet_pending' // hamyon rejimi: olib ketishda kuryer hamyonidan o'tkaziladi
  | 'wallet_settled' // hamyon rejimi: o'tkazildi
  | 'wallet_reversed' // o'tkazma teskari qilindi (yetkazish bekor / kuryer almashtirildi)
  | 'wallet_resettle_pending'; // teskaridan keyin yangi kuryer — olib ketishda qayta o'tkaziladi

export interface VendorCashView {
  step: VendorCashStep;
  /** Kuryer do'konga to'laydigan / to'lagan summa — faqat tovar, yetkazishsiz. */
  amount: number;
  /** Dispetcher izohi — faqat `resolved` da. */
  resolution?: string;
  /** Platforma komissiyasi — o'tkazma paytida saqlangan (`wallet_*`). */
  commission?: number;
  /** Sotuvchining sof tushumi (amount − commission). */
  net?: number;
  /** Oxirgi teskari payt — `wallet_reversed` / `wallet_resettle_pending`, yoki qayta o'tkazilgan `wallet_settled`. */
  reversedAt?: string;
  /** Necha marta teskari qilingan (qayta o'tkazilganini ko'rsatish uchun). */
  reversalCount?: number;
}

export interface VendorSettlementContext {
  mode?: VendorSettlementMode;
}

/** Kuryer biriktirilgan, lekin hali olib ketmagan (olib ketishda o'tkaziladi). */
const COURIER_ASSIGNED_STATUSES: ReadonlySet<string> = new Set(['accepted', 'arrived']);

function goodsAmount(order: VendorCashFields): number {
  return Math.round(order.items.reduce((sum, i) => sum + i.qty * Number(i.price), 0));
}

function settlementAmounts(s: VendorWalletSettlement) {
  return { amount: Number(s.amount), commission: Number(s.commission), net: Number(s.net) };
}

/** Hamyon o'tkazmasi holati yoki `null` (o'tkazma bo'lmagan — naqd oqimiga o'tiladi). */
function walletView(order: VendorCashFields, ctx: VendorSettlementContext): VendorCashView | null {
  const s = order.vendorWalletSettlement;
  if (s?.settledAt) {
    const view: VendorCashView = { step: 'wallet_settled', ...settlementAmounts(s) };
    return s.reversedAt ? { ...view, reversedAt: s.reversedAt, reversalCount: s.reversalCount } : view;
  }
  if (s?.reversedAt) {
    const courierAssigned = !!order.delivery && COURIER_ASSIGNED_STATUSES.has(order.delivery.status);
    const step = courierAssigned && ctx.mode !== 'cash' ? 'wallet_resettle_pending' : 'wallet_reversed';
    return { step, ...settlementAmounts(s), reversedAt: s.reversedAt, reversalCount: s.reversalCount };
  }
  // Eski backend (`vendorWalletSettlement` yo'q): faqat payt — summalar noma'lum.
  if (!s && order.vendorWalletSettledAt) return { step: 'wallet_settled', amount: goodsAmount(order) };
  return null;
}

export function vendorCashView(order: VendorCashFields, ctx: VendorSettlementContext = {}): VendorCashView {
  if (order.paymentMethod !== 'cash') return { step: 'none', amount: 0 };
  // Hamyon o'tkazmasi — rejimdan qat'i nazar haqiqat (rejim keyin o'zgargan bo'lishi mumkin).
  const wallet = walletView(order, ctx);
  if (wallet) return wallet;

  const amount = goodsAmount(order);
  if (order.vendorCashDisputeResolvedAt) {
    return { step: 'resolved', amount, resolution: order.vendorCashDisputeResolution ?? undefined };
  }
  if (order.vendorCashDisputedAt) return { step: 'disputed', amount };
  if (order.vendorCashConfirmedAt) return { step: 'confirmed', amount };
  // Hamyon rejimida sotuvchidan naqd tasdig'i so'ralmaydi.
  if (ctx.mode === 'wallet') return { step: 'wallet_pending', amount };
  if (order.vendorCashPaidAt) return { step: 'awaiting_vendor', amount };
  return { step: 'awaiting_courier', amount };
}
