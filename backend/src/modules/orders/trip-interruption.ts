import { InterruptReason } from '../../database/entities/order.entity';
import { FareBreakdown } from '../tariffs/fare-breakdown';

/**
 * Safar uzildi — avariya / buzilish (docs/INCIDENT-POLICY.md §5).
 *
 * NARX: "shu nuqtagacha". Eng ishonchli mavjud ma'lumot:
 *  · taksometrda — haydovchining GPS izi (`trip_track_points`), mavjud
 *    taksometr hisobi;
 *  · qat'iy narxda iz yozilmaydi — olish nuqtasidan uzilish nuqtasigacha
 *    TO'G'RI CHIZIQ masofasi (haydovchi yuborgan joy → oxirgi iz nuqtasi →
 *    bazadagi oxirgi joylashuv). To'g'ri chiziq haqiqiy yo'ldan qisqa —
 *    ya'ni yo'lovchi foydasiga xato.
 * Ikkala holda ham tarif bo'yicha (masofa + vaqt) hisoblanadi va qat'iy
 * narxdan OSHMAYDI: uzilgan safar to'liq safardan qimmat bo'la olmaydi.
 * Kutish haqi odatdagidek qo'shiladi (yo'lovchi boshqaradigan xarajat).
 */
export interface TripInterruption {
  reason: InterruptReason;
  /** Qat'iy narxli safarda olish → uzilish nuqtasi, km. Taksometrda e'tiborsiz. */
  distanceKm: number;
}

export function capInterruptedFare(
  meterFare: FareBreakdown,
  quote: FareBreakdown | null,
  isFixedPrice: boolean,
): FareBreakdown {
  if (isFixedPrice && quote && meterFare.total > quote.total) return quote;
  return meterFare;
}

/** Ikki nuqta orasidagi to'g'ri chiziq, km (haversine). */
export function straightLineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
