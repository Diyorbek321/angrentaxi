import type { BadgeVariant } from '@/components/ui/Badge';
import type { IntercityBookingKind, IntercityTripClass } from './intercity';
import { t } from '@/locales';

/**
 * Yo'lovchi so'rovlari doskasi — backend `IntercityRequestManageView`
 * (modules/intercity/intercity-request-view.ts). Mos qatnov topmagan yo'lovchi
 * so'rov qoldiradi (vaqt ORALIG'I bilan); haydovchi ilovadan qabul qiladi.
 * Dispetcher bu yerda kuzatadi va kerak bo'lsa yo'lovchiga qo'ng'iroq qiladi.
 */

export const INTERCITY_REQUEST_STATUSES = ['open', 'accepted', 'cancelled', 'expired'] as const;
export type IntercityRequestStatus = (typeof INTERCITY_REQUEST_STATUSES)[number];

interface RequestPlace {
  lat: number;
  lng: number;
  address: string;
}

export interface IntercityRequestManage {
  id: string;
  status: IntercityRequestStatus;
  routeId: string;
  originName: string | null;
  destinationName: string | null;
  tripClass: IntercityTripClass;
  kind: IntercityBookingKind;
  seats: number;
  pickup: RequestPlace;
  dropoff: RequestPlace;
  /** ISO 8601, UTC. */
  windowStart: string;
  windowEnd: string;
  /** Qat'iy narx + shahar ichiga davom (oshirishsiz). */
  basePrice: number;
  bonus: number;
  total: number;
  tripId: string | null;
  orderId: string | null;
  createdAt: string;
  passengerName: string | null;
  passengerPhone: string | null;
}

export interface IntercityRequestPage {
  items: IntercityRequestManage[];
  total: number;
  page: number;
  limit: number;
}

export function intercityRequestStatusLabels(): Record<IntercityRequestStatus, string> {
  return t().lib.intercity.requestStatus;
}

// Amber ('override') ATAYLAB yo'q — u qo'lda aralashuv uchun saqlangan.
export const INTERCITY_REQUEST_STATUS_BADGE: Record<IntercityRequestStatus, BadgeVariant> = {
  open: 'searching',
  accepted: 'success',
  cancelled: 'muted-danger',
  expired: 'neutral',
};

export function requestRouteName(request: Pick<IntercityRequestManage, 'originName' | 'destinationName'>): string {
  return `${request.originName || '—'} → ${request.destinationName || '—'}`;
}

export function requestKindLabel(request: Pick<IntercityRequestManage, 'kind' | 'seats'>): string {
  return request.kind === 'whole_car' ? t().lib.intercity.wholeCar : t().lib.intercity.seats(request.seats);
}

const TASHKENT_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tashkent',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function tashkentParts(iso: string): { day: string; time: string } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(TASHKENT_PARTS.formatToParts(date).map((p) => [p.type, p.value]));
  return { day: `${parts.day}.${parts.month}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * "18.10 · 14:00–16:00" — Toshkent vaqti (brauzer mintaqasidan qat'i nazar,
 * ilova bilan bir xil). Kun chegarasidan o'tsa: "18.10 · 22:00 – 19.10 · 02:00".
 */
export function formatRequestWindow(start: string, end: string): string {
  const a = tashkentParts(start);
  const b = tashkentParts(end);
  if (!a || !b) return '—';
  return a.day === b.day ? `${a.day} · ${a.time}–${b.time}` : `${a.day} · ${a.time} – ${b.day} · ${b.time}`;
}

/** Ro'yxatni yangilash kerak bo'lgan socket hodisalari (backend intercity-events.ts). */
export interface IntercityRequestClosedPayload {
  requestId: string;
  status: IntercityRequestStatus;
}
