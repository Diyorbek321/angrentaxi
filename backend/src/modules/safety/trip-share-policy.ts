import { createHash, randomBytes } from 'crypto';
import { DRIVER_ACTIVE_ORDER_STATUSES, OrderStatus } from '../../database/entities/order.entity';

/**
 * "Safarni ulashish" qoidalari (INCIDENT-POLICY §4) — sof funksiyalar.
 *
 *  · Havola faqat haydovchi biriktirilgan FAOL safarda yaratiladi.
 *  · Safar tugaguncha ochiq; tugagach (yakun yoki bekor) yana
 *    `tripShareGraceMinutes` daqiqa — keyin 410.
 *  · Token tasodifiy 32 bayt (base64url), bazada faqat SHA-256 xeshi.
 */
export const TRIP_SHARE_TOKEN_BYTES = 32;
/** Bitta buyurtmaga ko'pi bilan shuncha havola — cheksiz qator yozilmasin. */
export const TRIP_SHARE_MAX_LINKS_PER_ORDER = 10;
/** `GET share/:token` sahifasi o'zini shuncha soniyada yangilaydi (JS'siz). */
export const TRIP_SHARE_PAGE_REFRESH_SECONDS = 20;

export function newShareToken(): string {
  return randomBytes(TRIP_SHARE_TOKEN_BYTES).toString('base64url');
}

export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Tokenning shakli to'g'rimi — bazaga bormasdan rad etish uchun. */
export function isWellFormedShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{40,64}$/.test(token);
}

export function isShareableStatus(status: OrderStatus): boolean {
  return DRIVER_ACTIVE_ORDER_STATUSES.includes(status);
}

export interface ShareableOrderTimes {
  status: OrderStatus;
  completedAt: Date | null;
  /** Bekor qilingan lahza (052 dan keyin); eski qatorda `updatedAt` olinadi. */
  cancelledAt?: Date | null;
  updatedAt: Date;
}

/** Safar tugagan lahza; hali tugamagan bo'lsa `null`. */
export function tripEndedAt(order: ShareableOrderTimes): Date | null {
  if (order.status === OrderStatus.COMPLETED) return order.completedAt ?? order.updatedAt;
  if (order.status === OrderStatus.CANCELLED) return order.cancelledAt ?? order.updatedAt;
  return null;
}

/** Havola muddati: safar davom etsa `null` (ochiq), tugagan bo'lsa tugash + grace. */
export function shareLinkExpiresAt(order: ShareableOrderTimes, graceMinutes: number): Date | null {
  const ended = tripEndedAt(order);
  return ended ? new Date(new Date(ended).getTime() + graceMinutes * 60_000) : null;
}

export function isShareLinkExpired(order: ShareableOrderTimes, graceMinutes: number, now: Date): boolean {
  const expiresAt = shareLinkExpiresAt(order, graceMinutes);
  return expiresAt !== null && now.getTime() > expiresAt.getTime();
}

/** Ommaviy sahifa ko'rsatadigan narsa — telefon raqami YO'Q, olish manzili yo'q. */
export interface PublicTripView {
  status: OrderStatus;
  driverName: string;
  carModel: string | null;
  carNumber: string | null;
  dropoffAddress: string | null;
  /** Faqat safar davomida; tugagach `null`. */
  location: { lat: number; lng: number } | null;
  /** ISO; safar davom etsa `null`. */
  expiresAt: string | null;
}

/** Ism + familiya bosh harfi ("Alisher K.") — to'liq ism begonaga kerak emas. */
export function publicDriverName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const first = (firstName ?? '').trim();
  const initial = (lastName ?? '').trim().charAt(0);
  if (!first) return initial ? `${initial}.` : '—';
  return initial ? `${first} ${initial}.` : first;
}
