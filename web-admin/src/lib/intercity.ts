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
    ...validatePointExtension(form),
  };
}

const isPricePerKm = (value: number): boolean =>
  Number.isInteger(value) && value >= 0 && value <= INTERCITY_EXTENSION_MAX_PRICE_PER_KM;

/** Backend `validateIntercityPointExtension` bilan bir xil qoidalar. */
function validatePointExtension(form: IntercityPointForm): FormErrors<IntercityPointForm> {
  const { extensionMaxKm: maxKm, extensionPricePerKm: start, extensionComfortPricePerKm: comfort } = form;
  const maxKmValid = Number.isFinite(maxKm) && maxKm >= 0 && maxKm <= INTERCITY_EXTENSION_MAX_KM;
  const enabled = maxKmValid && maxKm > 0;
  if (!maxKmValid) return { extensionMaxKm: `0–${INTERCITY_EXTENSION_MAX_KM} km (0 — oʻchiq)` };
  if (!enabled) return {};
  const priceText = `1–${INTERCITY_EXTENSION_MAX_PRICE_PER_KM.toLocaleString('ru-RU')} soʻm, butun son`;
  return {
    ...(maxKm > form.radiusKm ? {} : { extensionMaxKm: 'Radiusdan katta boʻlishi kerak' }),
    ...(isPricePerKm(start) && start > 0 ? {} : { extensionPricePerKm: priceText }),
    ...(comfort === null || (isPricePerKm(comfort) && comfort >= start)
      ? {}
      : { extensionComfortPricePerKm: 'Start narxidan kam boʻlmasin' }),
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
  return `${point.extensionMaxKm} km · ${prices} soʻm/km`;
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
    ...(intInRange(form.intercityMaxDetourMinutes, 0, 120)
      ? {}
      : { intercityMaxDetourMinutes: '0–120 daqiqa (0 — oʻchiq)' }),
  };
}

// ─── Tumanlar ───────────────────────────────────────────────────────

/** Backend `INTERCITY_ZONE_RADIUS_*` va jadval CHECK'i bilan bir xil. */
export const INTERCITY_ZONE_RADIUS_MIN_KM = 0.3;
export const INTERCITY_ZONE_RADIUS_MAX_KM = 30;

export function validateZoneForm(form: IntercityZoneForm): FormErrors<IntercityZoneForm> {
  return {
    ...(form.name.trim().length > 0 && form.name.trim().length <= 80 ? {} : { name: 'Nomi 1–80 belgi' }),
    ...(Number.isFinite(form.centerLat) && form.centerLat >= -90 && form.centerLat <= 90
      ? {}
      : { centerLat: 'Kenglik −90…90' }),
    ...(Number.isFinite(form.centerLng) && form.centerLng >= -180 && form.centerLng <= 180
      ? {}
      : { centerLng: 'Uzunlik −180…180' }),
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
