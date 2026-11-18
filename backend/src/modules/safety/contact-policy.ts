import { DRIVER_ACTIVE_ORDER_STATUSES, OrderStatus } from '../../database/entities/order.entity';
import { UserRole } from '../../database/entities/user.entity';

/**
 * Telefon raqamini yashirish (INCIDENT-POLICY §4) — sof funksiyalar.
 *
 * Taksi va yetkazishda tomonlar bir-birining raqamini ko'rmaydi: yo'lovchi/
 * mijoz — haydovchi/kuryerni, haydovchi/kuryer — yo'lovchi/mijozni. Qo'ng'iroq
 * `POST orders/:id/call` orqali: server raqamni faqat faol buyurtmada,
 * faqat ishtirokchiga beradi va har so'rovni yozadi.
 *
 * Istisnolar:
 *  · menejer/admin — o'zgarishsiz (dispetcher ko'rinishi);
 *  · shaharlararo — o'z qoidasi bor (`intercity-contact-redaction.ts`);
 *  · sotuvchi telefoni (`details.vendorPhone`) — biznes raqami, ochiq;
 *  · posilka qabul qiluvchisi: yuboruvchi (`passengerId`) va xodim raqamni
 *    ko'radi; kuryer faqat niqobini (`details.recipientPhone`), qo'ng'iroq —
 *    `POST orders/:id/call { target: 'recipient' }`. Niqob satr bo'lib qoladi:
 *    eski APK `recipientPhone` satr bo'lmasa posilka kartasini umuman chizmaydi.
 *
 * ESKI ILOVA: `X-Client-Features` sarlavhasida `call-relay` yo'q mijoz
 * (v21 va oldingi APK) raqamni javobdan o'qiydi. Unga raqam FAQAT qo'ng'iroq
 * oynasi ochiq paytda qoldiriladi — ya'ni `/call` beradigan narsadan ortiq
 * emas, faqat jurnalsiz. Safar tugagach eski ilovaga ham raqam bormaydi.
 * `APP_MIN_BUILD_*` yangi build'ga ko'tarilgach bu yo'l amalda yopiladi.
 */
export const CLIENT_FEATURES_HEADER = 'x-client-features';
export const CALL_RELAY_FEATURE = 'call-relay';

/** Qo'ng'iroq oynasi: qabul qilingandan safar/yetkazish tugaguncha. */
export function callWindowOpen(status: OrderStatus): boolean {
  return DRIVER_ACTIVE_ORDER_STATUSES.includes(status);
}

/** Ilova "Bekor qilish narxi" ni tasdiqlashdan oldin ko'rsatadi (INCIDENT-POLICY §5). */
export const CANCEL_FEE_FEATURE = 'cancel-fee';

/** Posilka ekrani qiymat va taqiqlangan narsalar tasdig'ini yuboradi (§2). */
export const PARCEL_DECLARATION_FEATURE = 'parcel-declaration';

export function clientHasFeature(header: string | string[] | undefined, feature: string): boolean {
  const raw = Array.isArray(header) ? header.join(',') : (header ?? '');
  return raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .includes(feature);
}

export function clientSupportsCallRelay(header: string | string[] | undefined): boolean {
  return clientHasFeature(header, CALL_RELAY_FEATURE);
}

export interface ContactViewer {
  id: string;
  role: UserRole | string;
}

interface MaskableParty {
  phone?: string | null;
}

/** `+998901112233` → `+998 90 *** ** 33`. Boshqa shakl — oxirgi 2 raqam. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 ${digits.slice(3, 5)} *** ** ${digits.slice(-2)}`;
  }
  return `*** ** ${digits.slice(-2)}`;
}

/**
 * `details` nusxasi — qabul qiluvchi raqami niqoblangan. Taklif paketi
 * (socket va `current-offer`) ham shundan o'tadi: taklif hali buyurtmani
 * olmagan har bir haydovchiga boradi, socket'da esa `X-Client-Features` yo'q.
 * Eski ilova taklifda raqamni ko'rsatmaydi, qabuldan keyin REST javobi
 * uni almashtiradi.
 */
export function maskRecipientPhone<T extends Record<string, unknown> | null | undefined>(details: T): T {
  const phone = details?.recipientPhone;
  if (typeof phone !== 'string' || !phone) return details;
  return { ...details, recipientPhone: maskPhone(phone) };
}

/** Niqoblanadigan buyurtma shakli — `Order` va uning JSON ko'rinishi. */
export interface MaskableOrder {
  passengerId: string;
  driverId: string | null;
  status: OrderStatus;
  intercityTripId?: string | null;
  passenger?: MaskableParty | null;
  driver?: MaskableParty | null;
  details?: Record<string, unknown> | null;
}

export function isStaff(role: UserRole | string): boolean {
  return role === UserRole.MANAGER || role === UserRole.ADMIN;
}

/**
 * Qarshi tomon raqamini olib tashlangan NUSXA (asl obyekt o'zgarmaydi).
 * Ko'ruvchi buyurtma ishtirokchisi bo'lmasa ham ikkala raqam olinadi —
 * xavfsiz tomon.
 */
export function maskOrderContacts<T extends MaskableOrder>(
  order: T,
  viewer: ContactViewer,
  legacyClient: boolean,
): T {
  if (isStaff(viewer.role) || order.intercityTripId) return order;
  if (legacyClient && callWindowOpen(order.status)) return order;

  const isPassenger = order.passengerId === viewer.id;
  const isDriver = order.driverId !== null && order.driverId === viewer.id;
  const hideDriver = !isDriver;
  const hidePassenger = !isPassenger;

  const masked: T = { ...order };
  if (hideDriver && order.driver) masked.driver = { ...order.driver, phone: null };
  if (hidePassenger && order.passenger) masked.passenger = { ...order.passenger, phone: null };
  if (hidePassenger && order.details) {
    const details = maskRecipientPhone(order.details);
    masked.details = 'customerPhone' in details ? { ...details, customerPhone: null } : details;
  }
  return masked;
}

/** Javob tanasidagi buyurtma(lar)ni topib niqoblaydi: Order, Order[], `{ items|data: Order[] }`. */
export function maskResponseBody(body: unknown, viewer: ContactViewer, legacyClient: boolean): unknown {
  if (Array.isArray(body)) return body.map((item) => maskResponseBody(item, viewer, legacyClient));
  if (!body || typeof body !== 'object') return body;
  const record = body as Record<string, unknown>;
  if (looksLikeOrder(record)) {
    return maskOrderContacts(record as unknown as MaskableOrder, viewer, legacyClient);
  }
  for (const key of ['items', 'data', 'orders'] as const) {
    if (Array.isArray(record[key])) {
      return { ...record, [key]: maskResponseBody(record[key], viewer, legacyClient) };
    }
  }
  return body;
}

function looksLikeOrder(record: Record<string, unknown>): boolean {
  return typeof record.passengerId === 'string' && 'status' in record && ('driver' in record || 'passenger' in record || 'details' in record);
}
