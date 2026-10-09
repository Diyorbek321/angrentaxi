/**
 * Naqd buyurtma: kuryer tovar pulini do'konga O'Z pulidan to'laydi, mijozdan
 * esa yetkazish haqi bilan birga qaytarib oladi (backend `delivery/vendor-cash.ts`).
 * Sotuvchi "oldim" yoki "olmadim" deydi — ikkinchisi dispetcherga nizo.
 */
export interface VendorCashFields {
  paymentMethod: 'cash' | 'card';
  items: ReadonlyArray<{ qty: number; price: number }>;
  vendorCashPaidAt?: string | null;
  vendorCashConfirmedAt?: string | null;
  vendorCashDisputedAt?: string | null;
  /** Dispetcher nizoni yopdi (backend migratsiya 020). */
  vendorCashDisputeResolvedAt?: string | null;
  vendorCashDisputeResolution?: string | null;
}

export type VendorCashStep =
  | 'none' // karta — kuryer hech narsa to'lamaydi
  | 'awaiting_courier' // kuryer hali to'lamagan
  | 'awaiting_vendor' // kuryer to'ladim dedi — sotuvchi qarori kerak
  | 'confirmed'
  | 'disputed'
  | 'resolved'; // dispetcher nizoni yopdi

export interface VendorCashView {
  step: VendorCashStep;
  /** Kuryer do'konga to'laydigan summa — faqat tovar, yetkazishsiz. */
  amount: number;
  /** Dispetcher izohi — faqat `resolved` da. */
  resolution?: string;
}

export function vendorCashView(order: VendorCashFields): VendorCashView {
  const amount = Math.round(order.items.reduce((sum, i) => sum + i.qty * Number(i.price), 0));
  if (order.paymentMethod !== 'cash') return { step: 'none', amount: 0 };
  if (order.vendorCashDisputeResolvedAt) {
    return { step: 'resolved', amount, resolution: order.vendorCashDisputeResolution ?? undefined };
  }
  if (order.vendorCashDisputedAt) return { step: 'disputed', amount };
  if (order.vendorCashConfirmedAt) return { step: 'confirmed', amount };
  if (order.vendorCashPaidAt) return { step: 'awaiting_vendor', amount };
  return { step: 'awaiting_courier', amount };
}
