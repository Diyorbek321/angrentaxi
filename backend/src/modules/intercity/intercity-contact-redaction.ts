import { IntercityTripStatus } from '../../database/entities/intercity-trip.entity';
import { revealsDriverContact } from './intercity-lifecycle-policy';

/** Qaror uchun kerakli qatnov holati. */
export interface IntercityContactTrip {
  status: IntercityTripStatus;
  departureAt: Date;
}

interface WithDriverPhone {
  intercityTripId?: string | null;
  driver?: { phone?: string | null } | null;
}

/**
 * Shaharlararo bandda `orders.driver_id` band paytidayoq yoziladi — umumiy
 * `/orders` yo'llari (`:id`, `history`, `scheduled`) haydovchi telefonini
 * kunlar oldin ochib qo'yardi. Telefon faqat `revealsDriverContact` ruxsat
 * berganda qoladi (yig'ish boshlangan yoki jo'nashga ≤60 daqiqa).
 *
 * Qatnov topilmasa — xavfsiz tomonga, yashiriladi. Taksi buyurtmasi va
 * haydovchisiz buyurtma O'SHA obyekt bo'lib qaytadi; aks holda yangi nusxa
 * (asl obyekt o'zgarmaydi).
 */
export function redactUnrevealedDriverPhone<T extends WithDriverPhone>(
  order: T,
  trip: IntercityContactTrip | undefined,
  now: Date,
): T {
  if (!order.intercityTripId || !order.driver) return order;
  if (trip && revealsDriverContact(trip.status, trip.departureAt, now)) return order;
  return { ...order, driver: { ...order.driver, phone: null } };
}
