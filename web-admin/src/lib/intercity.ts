/**
 * Shaharlararo yo'nalishlar va nuqtalar — turlar, forma tekshiruvi, formatlash.
 *
 * Tekshiruv backend qoidalarining AYNAN nusxasi
 * (backend/src/modules/intercity/intercity-route-policy.ts va DTO'lar): admin
 * xatoni saqlash tugmasini bosmasdan, maydonning o'zida ko'rsin. Server baribir
 * o'zi tekshiradi — bu yerdagi qoida faqat qulaylik, himoya emas.
 */

export const INTERCITY_MAX_PRICE = 10_000_000;
export const INTERCITY_SEATS_MIN = 1;
export const INTERCITY_SEATS_MAX = 8;
export const INTERCITY_RADIUS_MIN_KM = 0.5;
export const INTERCITY_RADIUS_MAX_KM = 50;

// ─── Server shakllari (manage endpointlari entity'ni qaytaradi) ─────

export interface IntercityPoint {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
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
}

// ─── Formalar ───────────────────────────────────────────────────────

export interface IntercityPointForm {
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

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
  if (!Number.isFinite(value) || value <= 0) return `${label} 0 dan katta boʻlishi kerak`;
  if (!Number.isInteger(value)) return `${label} butun soʻmda kiritiladi`;
  if (value > INTERCITY_MAX_PRICE) return `${label} 10 000 000 soʻmdan oshmasin`;
  return undefined;
}

function comfortErrors(form: IntercityRouteForm): FormErrors<IntercityRouteForm> {
  const { comfortSeatPrice: seat, comfortWholeCarPrice: whole } = form;
  if (seat === null && whole === null) return {};
  if (seat === null) return { comfortSeatPrice: 'Comfort uchun ikkala narx birga kiritiladi' };
  if (whole === null) return { comfortWholeCarPrice: 'Comfort uchun ikkala narx birga kiritiladi' };

  const seatError =
    priceError(seat, 'Narx') ??
    (seat < form.seatPrice ? "Comfort oʻrindiq Start oʻrindiqdan arzon boʻlishi mumkin emas" : undefined);
  const wholeError =
    priceError(whole, 'Narx') ??
    (whole < form.wholeCarPrice
      ? "Comfort butun mashina Start'dan arzon boʻlishi mumkin emas"
      : whole < seat
        ? "Butun mashina bitta oʻrindiqdan arzon boʻlishi mumkin emas"
        : undefined);

  return {
    ...(seatError ? { comfortSeatPrice: seatError } : {}),
    ...(wholeError ? { comfortWholeCarPrice: wholeError } : {}),
  };
}

/** Bo'sh obyekt — forma to'g'ri. */
export function validateRouteForm(form: IntercityRouteForm): FormErrors<IntercityRouteForm> {
  const seatError = priceError(form.seatPrice, 'Narx');
  const wholeError =
    priceError(form.wholeCarPrice, 'Narx') ??
    (form.wholeCarPrice < form.seatPrice
      ? "Butun mashina bitta oʻrindiqdan arzon boʻlishi mumkin emas"
      : undefined);
  const seatsValid =
    Number.isInteger(form.seatsDefault) &&
    form.seatsDefault >= INTERCITY_SEATS_MIN &&
    form.seatsDefault <= INTERCITY_SEATS_MAX;

  return {
    ...(form.originPointId ? {} : { originPointId: 'Joʻnash nuqtasini tanlang' }),
    ...(!form.destinationPointId
      ? { destinationPointId: 'Borish nuqtasini tanlang' }
      : form.destinationPointId === form.originPointId
        ? { destinationPointId: 'Joʻnash va borish nuqtasi bir xil boʻlmasin' }
        : {}),
    ...(seatError ? { seatPrice: seatError } : {}),
    ...(wholeError ? { wholeCarPrice: wholeError } : {}),
    ...comfortErrors(form),
    ...(seatsValid
      ? {}
      : { seatsDefault: `${INTERCITY_SEATS_MIN}–${INTERCITY_SEATS_MAX} oraligʻida butun son` }),
  };
}

export function validatePointForm(form: IntercityPointForm): FormErrors<IntercityPointForm> {
  const latValid = Number.isFinite(form.centerLat) && form.centerLat >= -90 && form.centerLat <= 90;
  const lngValid = Number.isFinite(form.centerLng) && form.centerLng >= -180 && form.centerLng <= 180;
  const radiusValid =
    Number.isFinite(form.radiusKm) &&
    form.radiusKm >= INTERCITY_RADIUS_MIN_KM &&
    form.radiusKm <= INTERCITY_RADIUS_MAX_KM;
  return {
    ...(form.name.trim() ? {} : { name: 'Nuqta nomini kiriting' }),
    ...(latValid ? {} : { centerLat: 'Kenglik −90…90 oraligʻida' }),
    ...(lngValid ? {} : { centerLng: 'Uzunlik −180…180 oraligʻida' }),
    ...(radiusValid
      ? {}
      : { radiusKm: `Radius ${INTERCITY_RADIUS_MIN_KM}–${INTERCITY_RADIUS_MAX_KM} km` }),
  };
}

function intInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** Chegaralar backend `UpdateIntercitySettingsDto` bilan bir xil. */
export function validateIntercitySettings(form: IntercitySettings): FormErrors<IntercitySettings> {
  return {
    ...(intInRange(form.intercityFreeCancelMinutes, 0, 1440)
      ? {}
      : { intercityFreeCancelMinutes: '0–1440 daqiqa' }),
    ...(intInRange(form.intercityMaxSeatsPerBooking, 1, 8)
      ? {}
      : { intercityMaxSeatsPerBooking: '1–8 oʻrindiq' }),
    ...(intInRange(form.intercityMinLeadMinutes, 0, 720) ? {} : { intercityMinLeadMinutes: '0–720 daqiqa' }),
    ...(intInRange(form.intercityMaxAheadDays, 1, 30) ? {} : { intercityMaxAheadDays: '1–30 kun' }),
  };
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
