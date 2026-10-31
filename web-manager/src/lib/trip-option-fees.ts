import { t } from '@/locales';
/**
 * Safar opsiyalari uchun qo'shimcha haq (backend: `orders/trip-option-fees.ts`,
 * `PATCH /settings/trip-option-fees`). Menejer belgilaydi; buyurtma
 * berilganda narxga qo'shiladi va chekda alohida qator bo'lib chiqadi.
 */
export type TripOptionKey = 'child_seat' | 'pet' | 'air_conditioner' | 'big_luggage';

export type TripOptionFees = Partial<Record<TripOptionKey, number>>;

/** Backend `UpdateTripOptionFeesDto` bilan bir xil chegara. */
export const TRIP_OPTION_FEE_MAX = 100_000;

const TRIP_OPTION_KEYS: readonly TripOptionKey[] = ['child_seat', 'pet', 'air_conditioner', 'big_luggage'];

export function tripOptions(): ReadonlyArray<{ key: TripOptionKey; label: string }> {
  const labels = t().lib.tripOptions;
  return TRIP_OPTION_KEYS.map((key) => ({ key, label: labels[key] }));
}

/** Xato matni yoki `null`. Bo'sh maydon — "haqsiz" (0). */
export function validateFee(raw: string): string | null {
  const text = raw.trim();
  if (text === '') return null;
  if (!/^\d+$/.test(text)) return t().lib.tripOptionFee.positiveInt;
  if (Number(text) > TRIP_OPTION_FEE_MAX) {
    return t().lib.tripOptionFee.max(TRIP_OPTION_FEE_MAX.toLocaleString('ru-RU'));
  }
  return null;
}

/** Faqat o'zgargan opsiyalar; bo'sh maydon `0` (haqni olib tashlash). */
export function changedFees(
  current: TripOptionFees,
  draft: Record<TripOptionKey, string>
): TripOptionFees {
  const changes: TripOptionFees = {};
  for (const key of TRIP_OPTION_KEYS) {
    const next = draft[key].trim() === '' ? 0 : Number(draft[key]);
    if (next !== (current[key] ?? 0)) changes[key] = next;
  }
  return changes;
}
