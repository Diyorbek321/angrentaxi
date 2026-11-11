/**
 * Haydovchi o'zi o'ziga zakaz berib bonus yig'ayotganini aniqlash qoidalari.
 *
 * Sof funksiya — ma'lumot `OrderFraudService` da yig'iladi, qaror shu yerda.
 *
 * ⚠️ TIZIM AYBLAMAYDI, FAQAT BELGILAYDI (biznes qarori, 2026-10-06).
 * Shubhali safar to'lov va komissiyada oddiy safardek o'tadi, faqat bonus
 * va referal hisobiga kirmaydi. Qarorni menejer qiladi: tasdiqlasa bonus
 * qaytariladi. Sabab: har bir belgining halol izohi bor (oila a'zosini har
 * kuni olib yuradigan haydovchi, bekatda turgan mashina) — avtomatik jazo
 * begunoh haydovchini urardi.
 *
 * Kuchli belgi — bitta o'zi yetarli. Kuchsiz — ikkitasi birga bo'lsa.
 */
export type FraudSignal =
  /** Yo'lovchi va haydovchi ilovasi bitta telefonda (ANDROID_ID mos). */
  | 'same_device'
  /** Shu yo'lovchi-haydovchi juftligi 7 kunda 3+ safar. */
  | 'repeated_pair'
  /** Yangi akkaunt (<7 kun) va uning safarlari faqat shu haydovchi bilan. */
  | 'new_passenger_one_driver'
  /** Haydovchi qabul qilganda olish nuqtasida turgan (<50 m). */
  | 'driver_at_pickup'
  /** Safar <500 m yoki <2 daqiqa. */
  | 'too_short';

const STRONG: ReadonlySet<FraudSignal> = new Set([
  'same_device',
  'repeated_pair',
  'new_passenger_one_driver',
]);

export const REPEATED_PAIR_TRIPS = 3;
export const NEW_ACCOUNT_DAYS = 7;
export const AT_PICKUP_METERS = 50;
export const SHORT_TRIP_KM = 0.5;
export const SHORT_TRIP_MIN = 2;

export interface FraudFacts {
  sameDevice: boolean;
  /** Haydovchi qabul qilgan paytda olish nuqtasigacha masofa. Noma'lum — null. */
  acceptDistanceM: number | null;
  /** Shu juftlikning oxirgi 7 kundagi tugagan safarlari (shu safar bilan). */
  pairTripsLast7Days: number;
  passengerAccountAgeDays: number;
  /** Yo'lovchining jami tugagan safarlari (shu safar bilan). */
  passengerCompletedTrips: number;
  /** Ulardan shu haydovchi bilan bo'lganlari (shu safar bilan). */
  passengerTripsWithThisDriver: number;
  distanceKm: number | null;
  durationMin: number | null;
}

export interface FraudAssessment {
  signals: FraudSignal[];
  flagged: boolean;
}

export function assessTrip(f: FraudFacts): FraudAssessment {
  const signals: FraudSignal[] = [];

  if (f.sameDevice) signals.push('same_device');
  if (f.pairTripsLast7Days >= REPEATED_PAIR_TRIPS) signals.push('repeated_pair');
  // Birinchi safar hech qachon belgi emas — har bir yangi yo'lovchi birinchi
  // safarini KIMDIR bilan qiladi. Ikkinchi safar ham o'sha haydovchi bilan
  // bo'lsa — endi bu tasodif emas.
  if (
    f.passengerAccountAgeDays < NEW_ACCOUNT_DAYS &&
    f.passengerCompletedTrips >= 2 &&
    f.passengerTripsWithThisDriver === f.passengerCompletedTrips
  ) {
    signals.push('new_passenger_one_driver');
  }
  if (f.acceptDistanceM != null && f.acceptDistanceM < AT_PICKUP_METERS) {
    signals.push('driver_at_pickup');
  }
  if (
    (f.distanceKm != null && f.distanceKm < SHORT_TRIP_KM) ||
    (f.durationMin != null && f.durationMin < SHORT_TRIP_MIN)
  ) {
    signals.push('too_short');
  }

  const strong = signals.filter((s) => STRONG.has(s)).length;
  const weak = signals.length - strong;
  return { signals, flagged: strong >= 1 || weak >= 2 };
}

/** Qurilma identifikatori sarlavhasi — faqat xavfsiz belgilar, aks holda null. */
export function parseDeviceId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return /^[A-Za-z0-9_-]{6,64}$/.test(value) ? value : null;
}
