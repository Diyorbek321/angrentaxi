/**
 * Buyurtmaning v5 qo'shimchalari — docs/specs/food-market-ux-v5.md §1–§4:
 * manzil tafsilotlari, promokod / aksiya chegirmalari va mijoz bekor qilgani.
 *
 * Restoran va market panellarida BIR XIL. Backend parallel yozilmoqda —
 * har bir maydon ixtiyoriy deb qabul qilinadi (yo'q bo'lsa blok chiqmaydi).
 */

export interface AddressDetails {
  entrance?: string | null;
  floor?: string | null;
  apartment?: string | null;
  intercom?: string | null;
  landmark?: string | null;
  courierNote?: string | null;
}

export type CancelledBy = 'customer' | 'vendor' | 'courier' | 'manager' | 'admin' | 'system';

/** v5 maydonlari — vendor buyurtma turlari shu interfeysni kengaytiradi. */
export interface OrderV5Fields {
  addressDetails?: AddressDetails | null;
  promoCode?: string | null;
  promoDiscount?: number | null;
  promotionDiscount?: number | null;
  cancelledBy?: CancelledBy | string | null;
  cancelReason?: string | null;
  canCancel?: boolean;
}

const ADDRESS_FIELDS: ReadonlyArray<{ key: keyof AddressDetails; label: string; short?: string }> = [
  { key: 'entrance', label: 'Podyezd', short: 'podyezd' },
  { key: 'floor', label: 'Qavat', short: 'qavat' },
  { key: 'apartment', label: 'Xonadon', short: 'xonadon' },
  { key: 'intercom', label: 'Domofon', short: 'domofon' },
  { key: 'landmark', label: 'Moʻljal' },
  { key: 'courierNote', label: 'Kuryerga izoh' },
];

export interface AddressDetailLine {
  key: keyof AddressDetails;
  label: string;
  value: string;
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** To'ldirilgan maydonlar, spec tartibida. Bo'sh/null → chiqmaydi. */
export function addressDetailLines(details: AddressDetails | null | undefined): AddressDetailLine[] {
  if (!details || typeof details !== 'object') return [];
  return ADDRESS_FIELDS.flatMap(({ key, label }) => {
    const value = clean(details[key]);
    return value ? [{ key, label, value }] : [];
  });
}

/**
 * Kartadagi bir qatorli ko'rinish: "2-podyezd · 5-qavat · 34-xonadon · domofon 34K".
 * Mo'ljal va kuryerga izoh bu yerga kirmaydi — ular alohida, to'liq matn bilan.
 */
export function formatAddressShort(details: AddressDetails | null | undefined): string {
  if (!details || typeof details !== 'object') return '';
  const parts: string[] = [];
  const entrance = clean(details.entrance);
  const floor = clean(details.floor);
  const apartment = clean(details.apartment);
  const intercom = clean(details.intercom);
  if (entrance) parts.push(`${entrance}-podyezd`);
  if (floor) parts.push(`${floor}-qavat`);
  if (apartment) parts.push(`${apartment}-xonadon`);
  if (intercom) parts.push(`domofon ${intercom}`);
  return parts.join(' · ');
}

const positive = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

export interface OrderDiscounts {
  promoCode: string | null;
  /** Promokod chegirmasi — PLATFORMA hisobidan (vendor ulushi kamaymaydi). */
  promoDiscount: number;
  /** Aksiya chegirmasi — VENDOR hisobidan. */
  promotionDiscount: number;
  hasAny: boolean;
}

export function orderDiscounts(order: OrderV5Fields): OrderDiscounts {
  const promoCode = clean(order.promoCode) || null;
  const promoDiscount = positive(order.promoDiscount);
  const promotionDiscount = positive(order.promotionDiscount);
  return {
    promoCode,
    promoDiscount,
    promotionDiscount,
    hasAny: promoDiscount > 0 || promotionDiscount > 0 || promoCode != null,
  };
}

export function isCustomerCancelled(order: { status: string } & OrderV5Fields): boolean {
  return order.status === 'cancelled' && order.cancelledBy === 'customer';
}

/** "Mijoz bekor qildi" + sabab (bo'lsa). */
export function customerCancelText(order: OrderV5Fields): string {
  const reason = clean(order.cancelReason);
  return reason ? `Mijoz bekor qildi: ${reason}` : 'Mijoz bekor qildi';
}

export interface TrackedOrder extends OrderV5Fields {
  id: string;
  status: string;
}

/**
 * Poll'lar orasida mijoz bekor qilgan buyurtmalarni topadi. Birinchi
 * chaqiruv faqat holatni eslab qoladi (sahifa ochilganda eski bekorlar
 * uchun toast chiqmaydi). Keyin: oldin bekor qilinmagan holatda ko'rilgan
 * va endi `cancelledBy: 'customer'` bilan bekor qilingan buyurtmalar qaytadi.
 */
export function createCancellationTracker() {
  let known: Map<string, string> | null = null;
  return function track<T extends TrackedOrder>(orders: readonly T[]): T[] {
    const prev = known;
    known = new Map(orders.map((o) => [o.id, o.status]));
    if (prev === null) return [];
    return orders.filter((o) => {
      const before = prev.get(o.id);
      return before != null && before !== 'cancelled' && isCustomerCancelled(o);
    });
  };
}

/** `prev` da bor, `next` da yo'q id'lar — faqat "yangi" ro'yxatini poll qiladigan ramka uchun. */
export function disappearedIds(prev: readonly string[] | null, next: readonly string[]): string[] {
  if (!prev) return [];
  const set = new Set(next);
  return prev.filter((id) => !set.has(id));
}
