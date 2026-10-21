/**
 * Shaharlararo yo'nalishlar va nuqtalar — turlar, forma tekshiruvi, formatlash.
 *
 * Tekshiruv backend qoidalarining AYNAN nusxasi
 * (backend/src/modules/intercity/intercity-route-policy.ts va DTO'lar): admin
 * xatoni saqlash tugmasini bosmasdan, maydonning o'zida ko'rsin. Server baribir
 * o'zi tekshiradi — bu yerdagi qoida faqat qulaylik, himoya emas.
 */

import { t } from '@/locales';

export const INTERCITY_MAX_PRICE = 10_000_000;
export const INTERCITY_SEATS_MIN = 1;
export const INTERCITY_SEATS_MAX = 8;
export const INTERCITY_RADIUS_MIN_KM = 0.5;
export const INTERCITY_RADIUS_MAX_KM = 50;
/** "Shahar ichiga davom" chegaralari — backend `intercity-point-policy.ts` bilan bir xil. */
export const INTERCITY_EXTENSION_MAX_KM = 60;
export const INTERCITY_EXTENSION_MAX_PRICE_PER_KM = 50_000;

// ─── Server shakllari (manage endpointlari entity'ni qaytaradi) ─────

export interface IntercityPoint {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  /** "Shahar ichiga davom": 0 — o'chiq. */
  extensionMaxKm: number;
  /** Start, soʻm/km. */
  extensionPricePerKm: number;
  /** Comfort, soʻm/km; `null` — Start narxi. */
  extensionComfortPricePerKm: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface IntercityRoute {
  id: string;
  originPointId: string;
  destinationPointId: string;
  originPoint?: Pick<IntercityPoint, 'id' | 'name'> | null;
  destinationPoint?: Pick<IntercityPoint, 'id' | 'name'> | null;
  /** Start klass, bitta o'rindiq, so'm. */
  seatPrice: number;
  wholeCarPrice: number;
  /** Ikkalasi `null` — yo'nalishda Comfort yo'q. */
  comfortSeatPrice: number | null;
  comfortWholeCarPrice: number | null;
  seatsDefault: number;
  isActive: boolean;
  sortOrder: number;
}

export interface IntercitySettings {
  intercityEnabled: boolean;
  intercityFreeCancelMinutes: number;
  intercityMaxSeatsPerBooking: number;
  intercityMinLeadMinutes: number;
  intercityMaxAheadDays: number;
  /** Oʻrindiq bandi shahar ichidagi yoʻlni koʻpi bilan shuncha daqiqa uzaytiradi; 0 — oʻchiq. */
  intercityMaxDetourMinutes: number;
}

/** "Shahar ichiga davom" hududidagi tuman (backend migratsiya 039). */
export interface IntercityZone {
  id: string;
  pointId: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  isActive: boolean;
  sortOrder: number;
}

export interface IntercityZoneForm {
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

// ─── Formalar ───────────────────────────────────────────────────────

export interface IntercityPointForm {
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  extensionMaxKm: number;
  extensionPricePerKm: number;
  extensionComfortPricePerKm: number | null;
}

type PointExtension = Pick<
  IntercityPointForm,
  'extensionMaxKm' | 'extensionPricePerKm' | 'extensionComfortPricePerKm'
>;

export interface IntercityRouteForm {
  originPointId: string;
  destinationPointId: string;
  seatPrice: number;
  wholeCarPrice: number;
  comfortSeatPrice: number | null;
  comfortWholeCarPrice: number | null;
  seatsDefault: number;
}

export type FormErrors<T> = Partial<Record<keyof T, string>>;

function priceError(value: number, label: string): string | undefined {
  const v = t().intercity.validation;
  if (!Number.isFinite(value) || value <= 0) return v.priceZero(label);
  if (!Number.isInteger(value)) return v.priceInteger(label);
  if (value > INTERCITY_MAX_PRICE) return v.priceMax(label);
  return undefined;
}

function comfortErrors(form: IntercityRouteForm): FormErrors<IntercityRouteForm> {
  const v = t().intercity.validation;
  const { comfortSeatPrice: seat, comfortWholeCarPrice: whole } = form;
  if (seat === null && whole === null) return {};
  if (seat === null) return { comfortSeatPrice: v.comfortBoth };
  if (whole === null) return { comfortWholeCarPrice: v.comfortBoth };

  const seatError =
    priceError(seat, v.priceLabel) ?? (seat < form.seatPrice ? v.comfortSeatCheaper : undefined);
  const wholeError =
    priceError(whole, v.priceLabel) ??
    (whole < form.wholeCarPrice
      ? v.comfortWholeCheaper
      : whole < seat
        ? v.wholeCheaperThanSeat
        : undefined);

  return {
    ...(seatError ? { comfortSeatPrice: seatError } : {}),
    ...(wholeError ? { comfortWholeCarPrice: wholeError } : {}),
  };
}

/** Bo'sh obyekt — forma to'g'ri. */
export function validateRouteForm(form: IntercityRouteForm): FormErrors<IntercityRouteForm> {
  const v = t().intercity.validation;
  const seatError = priceError(form.seatPrice, v.priceLabel);
  const wholeError =
    priceError(form.wholeCarPrice, v.priceLabel) ??
    (form.wholeCarPrice < form.seatPrice ? v.wholeCheaperThanSeat : undefined);
  const seatsValid =
    Number.isInteger(form.seatsDefault) &&
    form.seatsDefault >= INTERCITY_SEATS_MIN &&
    form.seatsDefault <= INTERCITY_SEATS_MAX;

  return {
    ...(form.originPointId ? {} : { originPointId: v.originRequired }),
    ...(!form.destinationPointId
      ? { destinationPointId: v.destinationRequired }
      : form.destinationPointId === form.originPointId
        ? { destinationPointId: v.sameEnds }
        : {}),
    ...(seatError ? { seatPrice: seatError } : {}),
    ...(wholeError ? { wholeCarPrice: wholeError } : {}),
    ...comfortErrors(form),
    ...(seatsValid
      ? {}
      : { seatsDefault: v.seatsRange(INTERCITY_SEATS_MIN, INTERCITY_SEATS_MAX) }),
  };
}

export function validatePointForm(form: IntercityPointForm): FormErrors<IntercityPointForm> {
  const v = t().intercity.validation;
  const latValid = Number.isFinite(form.centerLat) && form.centerLat >= -90 && form.centerLat <= 90;
  const lngValid = Number.isFinite(form.centerLng) && form.centerLng >= -180 && form.centerLng <= 180;
  const radiusValid =
    Number.isFinite(form.radiusKm) &&
    form.radiusKm >= INTERCITY_RADIUS_MIN_KM &&
    form.radiusKm <= INTERCITY_RADIUS_MAX_KM;
  return {
    ...(form.name.trim() ? {} : { name: v.pointName }),
    ...(latValid ? {} : { centerLat: v.latRange }),
    ...(lngValid ? {} : { centerLng: v.lngRange }),
    ...(radiusValid ? {} : { radiusKm: v.radiusRange(INTERCITY_RADIUS_MIN_KM, INTERCITY_RADIUS_MAX_KM) }),
    ...validatePointExtension(form),
  };
}

const isPricePerKm = (value: number): boolean =>
  Number.isInteger(value) && value >= 0 && value <= INTERCITY_EXTENSION_MAX_PRICE_PER_KM;

/** Backend `validateIntercityPointExtension` bilan bir xil qoidalar. */
function validatePointExtension(form: IntercityPointForm): FormErrors<IntercityPointForm> {
  const v = t().intercity.validation;
  const { extensionMaxKm: maxKm, extensionPricePerKm: start, extensionComfortPricePerKm: comfort } = form;
  const maxKmValid = Number.isFinite(maxKm) && maxKm >= 0 && maxKm <= INTERCITY_EXTENSION_MAX_KM;
  const enabled = maxKmValid && maxKm > 0;
  if (!maxKmValid) return { extensionMaxKm: v.extensionKmRange(INTERCITY_EXTENSION_MAX_KM) };
  if (!enabled) return {};
  const priceText = v.extensionPrice(INTERCITY_EXTENSION_MAX_PRICE_PER_KM.toLocaleString('ru-RU'));
  return {
    ...(maxKm > form.radiusKm ? {} : { extensionMaxKm: v.extensionGtRadius }),
    ...(isPricePerKm(start) && start > 0 ? {} : { extensionPricePerKm: priceText }),
    ...(comfort === null || (isPricePerKm(comfort) && comfort >= start)
      ? {}
      : { extensionComfortPricePerKm: v.comfortNotBelowStart }),
  };
}

/** Jadval uchun: "30 km · 2 000 / 2 500 soʻm/km" yoki "—". */
export function formatPointExtension(point: PointExtension): string {
  if (point.extensionMaxKm <= 0 || point.extensionPricePerKm <= 0) return '—';
  const group = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const comfort = point.extensionComfortPricePerKm;
  const prices =
    comfort === null || comfort === point.extensionPricePerKm
      ? group(point.extensionPricePerKm)
      : `${group(point.extensionPricePerKm)} / ${group(comfort)}`;
  return `${point.extensionMaxKm} km · ${prices} ${t().intercity.validation.pricePerKmSuffix}`;
}

function intInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** Chegaralar backend `UpdateIntercitySettingsDto` bilan bir xil. */
export function validateIntercitySettings(form: IntercitySettings): FormErrors<IntercitySettings> {
  const v = t().intercity.validation;
  return {
    ...(intInRange(form.intercityFreeCancelMinutes, 0, 1440) ? {} : { intercityFreeCancelMinutes: v.freeCancelRange }),
    ...(intInRange(form.intercityMaxSeatsPerBooking, 1, 8) ? {} : { intercityMaxSeatsPerBooking: v.maxSeatsRange }),
    ...(intInRange(form.intercityMinLeadMinutes, 0, 720) ? {} : { intercityMinLeadMinutes: v.minLeadRange }),
    ...(intInRange(form.intercityMaxAheadDays, 1, 30) ? {} : { intercityMaxAheadDays: v.maxAheadRange }),
    ...(intInRange(form.intercityMaxDetourMinutes, 0, 120) ? {} : { intercityMaxDetourMinutes: v.detourRange }),
  };
}

// ─── Tumanlar ───────────────────────────────────────────────────────

/** Backend `INTERCITY_ZONE_RADIUS_*` va jadval CHECK'i bilan bir xil. */
export const INTERCITY_ZONE_RADIUS_MIN_KM = 0.3;
export const INTERCITY_ZONE_RADIUS_MAX_KM = 30;

export function validateZoneForm(form: IntercityZoneForm): FormErrors<IntercityZoneForm> {
  const v = t().intercity.validation;
  return {
    ...(form.name.trim().length > 0 && form.name.trim().length <= 80 ? {} : { name: v.zoneName }),
    ...(Number.isFinite(form.centerLat) && form.centerLat >= -90 && form.centerLat <= 90
      ? {}
      : { centerLat: v.zoneLat }),
    ...(Number.isFinite(form.centerLng) && form.centerLng >= -180 && form.centerLng <= 180
      ? {}
      : { centerLng: v.zoneLng }),
    ...(Number.isFinite(form.radiusKm) &&
    form.radiusKm >= INTERCITY_ZONE_RADIUS_MIN_KM &&
    form.radiusKm <= INTERCITY_ZONE_RADIUS_MAX_KM
      ? {}
      : { radiusKm: `${INTERCITY_ZONE_RADIUS_MIN_KM}–${INTERCITY_ZONE_RADIUS_MAX_KM} km` }),
  };
}

/** Tumanlar faqat "shahar ichiga davom" yoqilgan nuqtada maʼnoli. */
export function hasExtension(point: Pick<IntercityPoint, 'extensionMaxKm' | 'extensionPricePerKm'>): boolean {
  return (point.extensionMaxKm ?? 0) > 0 && (point.extensionPricePerKm ?? 0) > 0;
}

/**
 * Toshkent tumanlari — bir tugma bilan yaratiladigan tayyor roʻyxat.
 *
 * ⚠️ Markazlar TAXMINIY (tuman markazi atrofida), radius hammasida 4 km.
 * Admin keyin xaritaga qarab aniqlashtiradi — chegaradagi uylar ikki
 * tumanga tushishi yoki hech biriga tushmasligi mumkin.
 */
export const TASHKENT_ZONE_PRESET: readonly IntercityZoneForm[] = [
  { name: 'Bektemir', centerLat: 41.209, centerLng: 69.334, radiusKm: 4 },
  { name: 'Chilonzor', centerLat: 41.275, centerLng: 69.204, radiusKm: 4 },
  { name: 'Mirobod', centerLat: 41.288, centerLng: 69.276, radiusKm: 4 },
  { name: 'Mirzo Ulugʻbek', centerLat: 41.335, centerLng: 69.337, radiusKm: 4 },
  { name: 'Olmazor', centerLat: 41.355, centerLng: 69.216, radiusKm: 4 },
  { name: 'Sergeli', centerLat: 41.227, centerLng: 69.219, radiusKm: 4 },
  { name: 'Shayxontohur', centerLat: 41.326, centerLng: 69.238, radiusKm: 4 },
  { name: 'Uchtepa', centerLat: 41.29, centerLng: 69.165, radiusKm: 4 },
  { name: 'Yakkasaroy', centerLat: 41.285, centerLng: 69.255, radiusKm: 4 },
  { name: 'Yashnobod', centerLat: 41.29, centerLng: 69.335, radiusKm: 4 },
  { name: 'Yunusobod', centerLat: 41.365, centerLng: 69.288, radiusKm: 4 },
  { name: 'Yangihayot', centerLat: 41.205, centerLng: 69.235, radiusKm: 4 },
];

/** Tayyor roʻyxatdan hali yoʻqlari (nom boʻyicha, katta-kichik harfsiz), tartib raqami bilan. */
export function presetZonesToCreate(
  existing: ReadonlyArray<{ name: string }>,
): Array<IntercityZoneForm & { sortOrder: number }> {
  const taken = new Set(existing.map((zone) => zone.name.trim().toLocaleLowerCase('uz')));
  return TASHKENT_ZONE_PRESET.map((zone, index) => ({ ...zone, sortOrder: index })).filter(
    (zone) => !taken.has(zone.name.toLocaleLowerCase('uz')),
  );
}

// ─── Formatlash ─────────────────────────────────────────────────────

export function routeLabel(route: {
  originPoint?: { name: string } | null;
  destinationPoint?: { name: string } | null;
}): string {
  return `${route.originPoint?.name || '—'} → ${route.destinationPoint?.name || '—'}`;
}

/** Ixtiyoriy narx maydoni: bo'sh — `null` (Comfort yo'q), aks holda son (NaN bo'lishi mumkin). */
export function parseOptionalPrice(raw: string): number | null {
  return raw.trim() === '' ? null : Number(raw);
}

/**
 * Tahrirda uchlar YUBORILMAYDI: backend `PATCH` ularni o'zgartirmaydi —
 * boshqa uchlar boshqa yo'nalish (alohida qator) degani.
 */
export function toRoutePayload(
  form: IntercityRouteForm,
  mode: 'create' | 'update'
): IntercityRouteForm | Omit<IntercityRouteForm, 'originPointId' | 'destinationPointId'> {
  if (mode === 'create') return { ...form };
  const { originPointId: _origin, destinationPointId: _destination, ...rest } = form;
  return rest;
}
