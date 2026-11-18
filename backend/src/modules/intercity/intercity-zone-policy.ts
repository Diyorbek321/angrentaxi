import { ErrorReason } from '../../common/errors/coded-error';
import { haversineDistance } from '../orders/orders.distance.util';
import { ZonePoint, zoneOf } from './intercity-extension';
import { IntercityCircle } from './intercity-geo';

/**
 * Tumanlar (migratsiya 039): haydovchi qatnov e'lon qilganda shahar
 * ichidagi qaysi tumanlarga boradi/qaysilaridan oladi — shu. Bir mashinadagi
 * yo'lovchilar shaharning qarama-qarshi chekkalariga tarqalmaydi.
 */

/** Tuman radiusi chegarasi — jadval CHECK'i bilan bir xil. */
export const INTERCITY_ZONE_RADIUS_MIN_KM = 0.3;
export const INTERCITY_ZONE_RADIUS_MAX_KM = 30;

/** `reasons[].code` — kontrakt: o'zgartirmang, faqat qo'shing. */
export const INTERCITY_ZONE_REASONS = {
  nameEmpty: 'ZONE_NAME_EMPTY',
  radiusOutOfRange: 'ZONE_RADIUS_OUT_OF_RANGE',
  zoneNotAvailable: 'ZONE_NOT_AVAILABLE',
  extensionDisabled: 'ZONE_EXTENSION_DISABLED',
} as const;

export interface ZoneCircle extends IntercityCircle {
  id: string;
  name: string;
}

export interface SelectableZone extends ZoneCircle {
  pointId: string;
  isActive: boolean;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SideZoneFit {
  ok: boolean;
  /** Mos bo'lmasa — qatnov boradigan tumanlar (yo'lovchiga ko'rsatish uchun). */
  zoneNames: string[];
}

const reason = (code: string, message: string): ErrorReason => ({ code, message });

/** Manzil tushadigan birinchi tuman (tartib — ro'yxatdagi). */
export function zoneContaining<Z extends ZoneCircle>(zones: readonly Z[], lat: number, lng: number): Z | null {
  return zones.find((zone) => haversineDistance(zone.centerLat, zone.centerLng, lat, lng) <= zone.radiusKm) ?? null;
}

/**
 * Bitta tomon (olish yoki tushirish) manzili qatnov tumanlariga mosmi.
 *
 *  · nuqta radiusi ichida (Rohat krugining o'zi) — har doim mos;
 *  · qatnovda bu tomon uchun tuman tanlanmagan — butun davom hududi ochiq;
 *  · aks holda manzil tanlangan tumanlardan biriga tushishi kerak.
 *
 * Davom hududidan butunlay tashqarisi bu yerda emas — `evaluateBooking`
 * uni o'z sababi bilan rad etadi.
 */
export function sideZoneFit(point: ZonePoint, chosen: readonly ZoneCircle[], address: LatLng): SideZoneFit {
  if (chosen.length === 0) return { ok: true, zoneNames: [] };
  if (zoneOf(point, address.lat, address.lng) === 'inside') return { ok: true, zoneNames: [] };
  if (zoneContaining(chosen, address.lat, address.lng)) return { ok: true, zoneNames: [] };
  return { ok: false, zoneNames: chosen.map((zone) => zone.name) };
}

export type PublishZonesResult = { ok: true; zoneIds: string[] } | { ok: false; reasons: ErrorReason[] };

/**
 * E'londagi tumanlar: shu tomon nuqtasiga tegishli va faol bo'lishi kerak.
 * Bo'sh ro'yxat — "hamma tumanlar" (eski ilova shunday yuboradi).
 */
export function evaluatePublishZones(
  requested: readonly string[],
  pointId: string,
  extensionEnabled: boolean,
  zones: readonly SelectableZone[],
): PublishZonesResult {
  const zoneIds = [...new Set(requested)];
  if (zoneIds.length === 0) return { ok: true, zoneIds };
  if (!extensionEnabled) {
    return {
      ok: false,
      reasons: [
        reason(INTERCITY_ZONE_REASONS.extensionDisabled, "Bu nuqtada shahar ichiga davom yo'q — tuman tanlab bo'lmaydi"),
      ],
    };
  }
  const usable = new Set(zones.filter((zone) => zone.pointId === pointId && zone.isActive).map((zone) => zone.id));
  if (zoneIds.some((id) => !usable.has(id))) {
    return {
      ok: false,
      reasons: [reason(INTERCITY_ZONE_REASONS.zoneNotAvailable, "Tanlangan tuman bu nuqtaga tegishli emas yoki faol emas")],
    };
  }
  return { ok: true, zoneIds };
}

/** Admin formasi: nom va radius (koordinata DTO'da tekshiriladi). */
export function evaluateZoneInput(input: { name?: string; radiusKm?: number }): ErrorReason[] {
  return [
    ...(input.name !== undefined && input.name.trim().length === 0
      ? [reason(INTERCITY_ZONE_REASONS.nameEmpty, "Tuman nomi bo'sh bo'lishi mumkin emas")]
      : []),
    ...(input.radiusKm !== undefined &&
    (input.radiusKm < INTERCITY_ZONE_RADIUS_MIN_KM || input.radiusKm > INTERCITY_ZONE_RADIUS_MAX_KM)
      ? [
          reason(
            INTERCITY_ZONE_REASONS.radiusOutOfRange,
            `Tuman radiusi ${INTERCITY_ZONE_RADIUS_MIN_KM}–${INTERCITY_ZONE_RADIUS_MAX_KM} km bo'lishi kerak`,
          ),
        ]
      : []),
  ];
}
