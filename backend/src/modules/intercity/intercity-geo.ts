import { haversineDistance } from '../orders/orders.distance.util';

export interface IntercityCircle {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

/**
 * Nuqta shaharlararo nuqtaning doirasi ichidami.
 *
 * Yo'lovchini olish joyi qatnov BOSHLANISH nuqtasida, tushirish joyi esa
 * MANZIL nuqtasida bo'lishi shart: Angren → Rohat krugi qatnoviga Olmaliqdan
 * olib ketish band qilinsa, haydovchi narxga kirmagan yo'lni bosib o'tardi.
 *
 * `NaN` koordinata `false` beradi — taqqoslash `NaN <= r` doim yolg'on.
 */
export function isInsidePoint(point: IntercityCircle, lat: number, lng: number): boolean {
  return haversineDistance(point.centerLat, point.centerLng, lat, lng) <= point.radiusKm;
}
