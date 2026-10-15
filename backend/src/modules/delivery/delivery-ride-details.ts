import type { AddressDetails } from '../../database/entities/address-details';

/**
 * What the courier sees about the bag they are carrying, stored on the
 * courier ride's `details` next to `foodOrderId`/`marketOrderId`.
 *
 * `collectCash` is the one field that matters most: on a cash order the
 * courier must take the vendor's total from the customer at the door, and
 * before this the driver app had no way to know that number — it only showed
 * the ride fare.
 */
export interface DeliveryRideDetails {
  vendorName: string;
  vendorPhone: string | null;
  customerPhone: string | null;
  itemsCount: number;
  /** So'm to take from the customer at handover; 0 when paid online. */
  collectCash: number;
  /**
   * So'm the courier pays the vendor at pickup (goods only, no delivery fee);
   * 0 when paid online. See `vendor-cash.ts`: the courier buys the bag with
   * their own cash and recovers it — plus the delivery fee — at the door.
   */
  payVendor: number;
  /**
   * Promokod chegirmasi (so'm, PLATFORMA hisobidan): `collectCash` shuncha
   * kam. Kuryerga platforma yetkazilganda qaytaradi (`promo-compensation.ts`).
   */
  promoDiscount: number;
  /** Podyezd/qavat/domofon/mo'ljal/izoh (docs/specs/food-market-ux-v5.md §3). */
  addressDetails: AddressDetails | null;
}

export function deliveryRideDetails(input: {
  vendorName: string;
  vendorPhone: string | null;
  customerPhone: string | null;
  itemsCount: number;
  totalPrice: number;
  /** Goods only — `totalPrice` minus the delivery fee. */
  itemsTotal: number;
  isCash: boolean;
  /** Platforma hisobidan promokod chegirmasi (so'm). */
  promoDiscount?: number;
  addressDetails?: AddressDetails | null;
}): DeliveryRideDetails {
  const promoDiscount = Math.max(0, Math.round(input.promoDiscount ?? 0));
  return {
    vendorName: input.vendorName,
    vendorPhone: input.vendorPhone,
    customerPhone: input.customerPhone,
    itemsCount: input.itemsCount,
    collectCash: input.isCash ? Math.max(0, Math.round(input.totalPrice) - promoDiscount) : 0,
    payVendor: input.isCash ? Math.round(input.itemsTotal) : 0,
    promoDiscount,
    addressDetails: input.addressDetails ?? null,
  };
}

/**
 * The delivery fee the customer paid at checkout, recovered from the order
 * itself: checkout stores `totalPrice = Σ(qty × price) + deliveryFee`.
 *
 * Read back from the order rather than from today's platform setting, so an
 * admin changing the fee between checkout and "ready" cannot change what this
 * customer's courier ride costs.
 */
export function checkoutDeliveryFee(order: {
  totalPrice: number;
  items: ReadonlyArray<{ qty: number; price: number }>;
}): number {
  const itemsTotal = order.items.reduce((sum, item) => sum + item.qty * item.price, 0);
  return Math.max(0, Math.round(order.totalPrice - itemsTotal));
}
