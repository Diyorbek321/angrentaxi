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
  /** Hozirgi backend bermaydi — bo'lsa "Butun mashina" belgisi chiqadi. */
  wholeCarBooked?: boolean;
  seatPrice: number;
  wholeCarPrice: number;
  driver: { firstName: string | null; rating: number; carModel: string | null; plate: string | null } | null;
  cancelReason: string | null;
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
