import { BadRequestException } from '@nestjs/common';

/**
 * Naqd ovqat/market buyurtmasida sotuvchi bilan hisob-kitob
 * (biznes qarori, 2026-10-07, migratsiya 019).
 *
 * Kuryer tovarni do'kondan olayotganda tovar summasini O'Z pulidan to'laydi
 * (`DeliveryRideDetails.payVendor`), mijozdan esa tovar + yetkazish haqini
 * oladi (`collectCash`). Shu sababli:
 *  · naqd buyurtma chegaralangan — kuryer katta summani to'lamasin;
 *  · kuryer "to'ladim" demaguncha tovarni olib keta olmaydi (safar boshlanmaydi);
 *  · sotuvchi "oldim" yoki "olmadim" deydi — ikkinchisi dispetcherga nizo.
 *
 * Platforma hisobi o'zgarmaydi: naqd buyurtmada sotuvchidan faqat komissiya
 * yechiladi (pulni u qo'lida oldi), kuryer esa yetkazish haqini oladi.
 */
export function assertCashWithinLimit(isCash: boolean, totalPrice: number, limit: number): void {
  if (!isCash || !(limit > 0) || totalPrice <= limit) return;
  throw new BadRequestException(
    `Naqd to'lov ${formatSom(limit)} so'mgacha. Bu buyurtmani karta bilan to'lang.`,
  );
}

export type VendorCashState =
  /** Karta bilan to'langan — kuryer do'konga hech narsa to'lamaydi. */
  | 'not_applicable'
  | 'awaiting_courier'
  | 'awaiting_vendor'
  | 'confirmed'
  | 'disputed'
  /** Dispetcher nizoni yopdi. */
  | 'resolved';

export interface VendorCashColumns {
  vendorCashPaidAt: Date | null;
  vendorCashConfirmedAt: Date | null;
  vendorCashDisputedAt: Date | null;
  vendorCashDisputeResolvedAt?: Date | null;
}

export function vendorCashState(isCash: boolean, order: VendorCashColumns): VendorCashState {
  if (!isCash) return 'not_applicable';
  if (order.vendorCashDisputeResolvedAt) return 'resolved';
  if (order.vendorCashDisputedAt) return 'disputed';
  if (order.vendorCashConfirmedAt) return 'confirmed';
  if (order.vendorCashPaidAt) return 'awaiting_vendor';
  return 'awaiting_courier';
}

function formatSom(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
