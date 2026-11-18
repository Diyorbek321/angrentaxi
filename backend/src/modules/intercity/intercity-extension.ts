import { IntercityTripClass } from '../../database/entities/intercity-trip.entity';
import { haversineDistance } from '../orders/orders.distance.util';
import { FareBreakdown, IntercityExtensionCharge, agreedFareBreakdown } from '../tariffs/fare-breakdown';
import { IntercityCircle } from './intercity-geo';

/**
 * "Shahar ichiga davom" — nuqtadan (Rohat krugi) yo'lovchi manzilgacha km haqi.
 *
 * Qatnovning qat'iy narxi nuqtagacha. Yo'lovchi Toshkent ichidagi uyiga
 * eltib qo'yilishini (yoki uyidan olinishini) xohlasa, nuqta markazidan
 * manzilgacha YO'L masofasi uchun alohida haq qo'shiladi. Har band uchun —
 * har yo'lovchining manzili o'zi.
 */
export interface ExtensionPoint extends IntercityCircle {
  name: string;
  /** 0 — davom o'chiq; nuqta markazidan to'g'ri chiziq bo'yicha chegara. */
  extensionMaxKm: number;
  extensionPricePerKm: number;
  /** null — Comfort ham Start narxida. */
  extensionComfortPricePerKm: number | null;
}

export type PointZone = 'inside' | 'extension' | 'outside';

/** `zoneOf` uchun yetarli shakl — davom maydonlari yo'q bo'lsa davom o'chiq. */
export type ZonePoint = IntercityCircle & Partial<Pick<ExtensionPoint, 'extensionMaxKm' | 'extensionPricePerKm'>>;

/**
 * Narx 500 so'mga YUQORIGA yaxlitlanadi: naqd pilotda haydovchi 24 800 so'm
 * qaytimini topolmaydi, pastga yaxlitlash esa uning pulini kesardi.
 */
export const EXTENSION_ROUNDING_STEP = 500;

/**
 * Marshrut xizmati javob bermasa: to'g'ri chiziq × 1.3 — shahar ichida yo'l
 * masofasi odatda to'g'ri chiziqdan 25–40% uzun. Taxmin `estimated` bilan
 * belgilanadi.
 */
export const ROAD_DISTANCE_FALLBACK_FACTOR = 1.3;

/**
 * Davom chegarasi TO'G'RI CHIZIQ bo'yicha — u yo'lovchi manzil tanlayotgan
 * lahzada tarmoqsiz tekshiriladi va marshrut xizmati ishlamasa ham bir xil
 * javob beradi. Narx esa yo'l masofasidan.
 */
export function zoneOf(point: ZonePoint, lat: number, lng: number): PointZone {
  const km = haversineDistance(point.centerLat, point.centerLng, lat, lng);
  if (km <= point.radiusKm) return 'inside';
  const maxKm = point.extensionMaxKm ?? 0;
  const enabled = maxKm > 0 && (point.extensionPricePerKm ?? 0) > 0;
  return enabled && km <= maxKm ? 'extension' : 'outside';
}

export function extensionRate(point: ExtensionPoint, tripClass: IntercityTripClass): number {
  return tripClass === IntercityTripClass.COMFORT
    ? (point.extensionComfortPricePerKm ?? point.extensionPricePerKm)
    : point.extensionPricePerKm;
}

/** Metrdan km, 0.1 aniqlikda. */
export function kmFromMeters(meters: number): number {
  return Math.round(meters / 100) / 10;
}

/**
 * ⚠️ BUTUN SONLARDA hisoblanadi (km o'ndan birlarda): `0.3 * 2500` kabi
 * suzuvchi nuqta natijasi 750.0000001 bo'lib, `ceil` uni keyingi 500 ga
 * sakratib yuborardi.
 */
export function priceExtension(km: number, pricePerKm: number): number {
  const tenths = Math.round(km * 10);
  if (tenths <= 0 || pricePerKm <= 0) return 0;
  const steps = Math.ceil((tenths * pricePerKm) / (10 * EXTENSION_ROUNDING_STEP));
  return steps * EXTENSION_ROUNDING_STEP;
}

/**
 * Qat'iy narx + davom qatorlari. Davom yig'indisi `distanceFare` ga tushadi,
 * shuning uchun chek invarianti (`fare-breakdown.ts`) o'zgarishsiz ishlaydi.
 */
export function composeIntercityFare(
  basePrice: number,
  extensions: readonly IntercityExtensionCharge[],
  durationMin: number,
): FareBreakdown {
  const extensionFare = extensions.reduce((sum, charge) => sum + charge.fare, 0);
  const extensionKm = Math.round(extensions.reduce((sum, charge) => sum + charge.km, 0) * 10) / 10;
  const rates = new Set(extensions.map((charge) => charge.pricePerKm));
  return {
    ...agreedFareBreakdown(basePrice, extensionKm, durationMin),
    distanceKm: extensionKm,
    // Ikki tomon turli narxda bo'lsa bitta "km narxi" chekda yolg'on bo'lardi.
    pricePerKm: rates.size === 1 ? [...rates][0] : 0,
    distanceFare: extensionFare,
    intercityExtensions: [...extensions],
    total: basePrice + extensionFare,
  };
}
