import type { BadgeVariant } from '@/components/ui/Badge';

/**
 * Shaharlararo qatnovlar — backend `IntercityTripView` (modules/intercity/
 * intercity-trip-view.ts) shakli, holat yorliqlari va Toshkent kuni.
 */

export const INTERCITY_TRIP_STATUSES = [
  'open',
  'full',
  'boarding',
  'in_progress',
  'completed',
  'cancelled',
] as const;

export type IntercityTripStatus = (typeof INTERCITY_TRIP_STATUSES)[number];
export type IntercityTripClass = 'start' | 'comfort';

export interface IntercityTripView {
  id: string;
  route: {
    id: string;
    origin: { id: string; name: string };
    destination: { id: string; name: string };
  };
  tripClass: IntercityTripClass;
  departureAt: string;
  status: IntercityTripStatus;
  seatsTotal: number;
  seatsLeft: number;
  wholeCarAvailable: boolean;
  /** Bitta band butun mashinani olgan — joylar soni bilan farqlab bo'lmaydi. */
  wholeCarBooked?: boolean;
  seatPrice: number;
  wholeCarPrice: number;
  driver: {
    firstName: string | null;
    rating: number;
    carModel: string | null;
    plate: string | null;
    /** Faqat `/intercity/trips/manage` ko'rinishida — yo'lovchiga hech qachon. */
    phone?: string | null;
  } | null;
  cancelReason: string | null;
  /** Haydovchi tanlagan tumanlar (backend 039); bo'sh — butun davom hududi. */
  zones?: {
    origin: Array<{ id: string; name: string }>;
    destination: Array<{ id: string; name: string }>;
  };
}

/**
 * Bir tomon tumanlari — modalda ko'rsatish uchun. Bo'sh ro'yxat "hamma
 * tumanlar" degani (haydovchi cheklamagan), "tuman yo'q" emas.
 */
export function zonesLabel(zones: ReadonlyArray<{ name: string }> | undefined): string {
  return zones && zones.length > 0 ? zones.map((zone) => zone.name).join(', ') : 'Hamma tumanlar';
}

export interface IntercityTripPage {
  items: IntercityTripView[];
  total: number;
  page: number;
  limit: number;
}

export const INTERCITY_STATUS_LABELS: Record<IntercityTripStatus, string> = {
  open: 'Joy bor',
  full: 'Toʻla',
  boarding: 'Yoʻlovchi yigʻmoqda',
  in_progress: 'Yoʻlda',
  completed: 'Yakunlandi',
  cancelled: 'Bekor qilindi',
};

// Amber ('override') ATAYLAB yo'q — u qo'lda aralashuv uchun saqlangan.
export const INTERCITY_STATUS_BADGE: Record<IntercityTripStatus, BadgeVariant> = {
  open: 'info',
  full: 'success',
  boarding: 'searching',
  in_progress: 'violet',
  completed: 'neutral',
  cancelled: 'muted-danger',
};

export function tripClassLabel(tripClass: IntercityTripClass): string {
  return tripClass === 'comfort' ? 'Comfort' : 'Start';
}

/** Band qilingan o'rindiqlar. Butun mashina bandida `seatsLeft` 0 — hammasi band. */
export function seatsTaken(trip: Pick<IntercityTripView, 'seatsTotal' | 'seatsLeft'>): number {
  return Math.max(0, trip.seatsTotal - trip.seatsLeft);
}

export function isWholeCarBooked(trip: Pick<IntercityTripView, 'wholeCarBooked'>): boolean {
  return trip.wholeCarBooked === true;
}

/**
 * `YYYY-MM-DD` Toshkent vaqti bo'yicha (backend `?date=` shu kunni kutadi).
 * Brauzer qaysi mintaqada bo'lishidan qat'i nazar.
 */
export function tashkentDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Kalendar kuni bo'yicha siljitish (UTC'da hisoblanadi — DST yo'q, sakrash yo'q). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Buyurtma `serviceType` yorliqlari (backend ServiceType enum). */
export const SERVICE_TYPE_LABELS: Readonly<Record<string, string>> = {
  taxi: 'Taksi',
  cargo: 'Yuk',
  food: 'Ovqat',
  market: 'Market',
  parcel: 'Posilka',
  intercity: 'Shaharlararo',
};

export function serviceTypeLabel(serviceType: string | null | undefined): string {
  if (!serviceType) return SERVICE_TYPE_LABELS.taxi;
  return SERVICE_TYPE_LABELS[serviceType] ?? serviceType;
}

// ─── Bandlar (dispetcher) ───────────────────────────────────────────────────

/** Backend `OrderStatus` — intercity bandi `scheduled` dan boshlanadi. */
export type IntercityBookingStatus =
  | 'scheduled'
  | 'accepted'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export type IntercityBookingKind = 'seat' | 'whole_car';

/** `GET /intercity/trips/:id/bookings/manage` qatori (intercity-booking-manage-view.ts). */
export interface IntercityBookingManage {
  orderId: string;
  passenger: { name: string; phone: string | null };
  seats: number | null;
  bookingKind: IntercityBookingKind | null;
  status: IntercityBookingStatus;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  price: number;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export const INTERCITY_BOOKING_STATUS_LABELS: Record<IntercityBookingStatus, string> = {
  scheduled: 'Band qilingan',
  accepted: 'Yigʻilmoqda',
  arrived: 'Haydovchi keldi',
  in_progress: 'Yoʻlda',
  completed: 'Yetkazildi',
  cancelled: 'Bekor qilingan',
};

export const INTERCITY_BOOKING_STATUS_BADGE: Record<IntercityBookingStatus, BadgeVariant> = {
  scheduled: 'neutral',
  accepted: 'info',
  arrived: 'info',
  in_progress: 'success',
  completed: 'success',
  cancelled: 'muted-danger',
};

export function bookingKindLabel(booking: Pick<IntercityBookingManage, 'bookingKind' | 'seats'>): string {
  if (booking.bookingKind === 'whole_car') return 'Butun mashina';
  return `${booking.seats ?? 1} joy`;
}

/**
 * Dispetcher bandni faqat yig'ish boshlanmasdan bekor qila oladi — backend
 * `cancel/manage` ham shu shartni tekshiradi; tugma noto'g'ri holatda
 * ko'rinmasin.
 */
export function canDispatcherCancel(booking: Pick<IntercityBookingManage, 'status'>): boolean {
  return booking.status === 'scheduled';
}

/** `intercity:trip:updated` yuki (backend intercity-events.ts). */
export interface IntercityTripUpdatedPayload {
  tripId: string;
  status: IntercityTripStatus;
  seatsTaken: number;
  seatsTotal: number;
  wholeCarBooked: boolean;
  departureAt: string;
}

/**
 * Socket hodisasini ro'yxatdagi qatnovga qo'llaydi (yangi nusxa). Ro'yxatda
 * yo'q qatnov — `null`: chaqiruvchi to'liq qayta yuklaydi (yangi e'lon yoki
 * boshqa kun).
 */
export function applyTripUpdate(
  page: IntercityTripPage,
  payload: IntercityTripUpdatedPayload,
): IntercityTripPage | null {
  const index = page.items.findIndex((trip) => trip.id === payload.tripId);
  if (index === -1) return null;
  const current = page.items[index];
  const seatsLeft = payload.wholeCarBooked ? 0 : Math.max(0, payload.seatsTotal - payload.seatsTaken);
  const updated: IntercityTripView = {
    ...current,
    status: payload.status,
    seatsTotal: payload.seatsTotal,
    seatsLeft,
    wholeCarBooked: payload.wholeCarBooked,
    wholeCarAvailable: payload.status === 'open' && payload.seatsTaken === 0 && !payload.wholeCarBooked,
    departureAt: payload.departureAt,
  };
  return { ...page, items: page.items.map((trip, i) => (i === index ? updated : trip)) };
}
