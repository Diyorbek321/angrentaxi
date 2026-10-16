import { IntercityBookingKind, OrderStatus } from '../../database/entities/order.entity';

/**
 * Haydovchi uchun qatnov bandi (`GET intercity/trips/:id/bookings`).
 *
 * Koordinatalar BOR — ilova yo'lovchilarni haydovchidan eng yaqinidan
 * boshlab tartiblaydi. Yo'lovchi telefoni esa haydovchi telefoni bilan
 * SIMMETRIK: faqat `revealsDriverContact` ruxsat berganda (yig'ish
 * boshlangan yoki jo'nashga ≤60 daqiqa). Kunlar oldin ochilsa, band
 * platformadan tashqariga ko'chib ketardi.
 */
export interface IntercityDriverBookingView {
  orderId: string;
  status: OrderStatus;
  seats: number | null;
  bookingKind: IntercityBookingKind | null;
  price: number;
  passenger: { name: string; phone: string | null };
  pickupAddress: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  createdAt: string;
}

/** Xom SQL qatori — `geometry` ustunlari `ST_Y/ST_X` bilan o'qiladi. */
export interface IntercityDriverBookingRow {
  id: string;
  status: OrderStatus;
  seats: number | null;
  booking_kind: IntercityBookingKind | null;
  estimated_price: string;
  final_price: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  pickup_address: string | null;
  pickup_lat: string | null;
  pickup_lng: string | null;
  dropoff_address: string | null;
  dropoff_lat: string | null;
  dropoff_lng: string | null;
  created_at: Date;
}

const toNumberOrNull = (value: string | null): number | null => (value === null ? null : Number(value));

export function toIntercityDriverBookingView(
  row: IntercityDriverBookingRow,
  revealPhone: boolean,
): IntercityDriverBookingView {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ');
  return {
    orderId: row.id,
    status: row.status,
    seats: row.seats,
    bookingKind: row.booking_kind,
    price: Number(row.final_price ?? row.estimated_price),
    passenger: { name, phone: revealPhone ? row.phone : null },
    pickupAddress: row.pickup_address,
    pickupLat: toNumberOrNull(row.pickup_lat),
    pickupLng: toNumberOrNull(row.pickup_lng),
    dropoffAddress: row.dropoff_address,
    dropoffLat: toNumberOrNull(row.dropoff_lat),
    dropoffLng: toNumberOrNull(row.dropoff_lng),
    createdAt: new Date(row.created_at).toISOString(),
  };
}
