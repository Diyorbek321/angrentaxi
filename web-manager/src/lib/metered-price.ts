import { z } from 'zod';
import { t } from '@/locales';

/**
 * Taksometr (manzilsiz safar) km narxi — ixtiyoriy maydon. Bo'sh qoldirilsa
 * `null`: backend shu tarifning oddiy km narxini ishlatadi
 * (`backend/src/modules/tariffs/metered-rate.ts`).
 *
 * `z.coerce.number()` bo'sh satrni 0 ga aylantiradi — bu yerda 0 "taksometr
 * bepul" degani bo'lib qolardi, shuning uchun bo'sh qiymat avval `null`ga
 * o'giriladi.
 */
export function meteredPriceField() {
  const m = t().lib.meteredPrice;
  return z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? null : value),
    z.coerce.number({ invalid_type_error: m.number }).min(0, m.nonNegative).nullable()
  );
}

/** Tarif kartasidagi qiymat: o'rnatilmagan bo'lsa oddiy km narxi amal qiladi. */
export function meteredPriceLabel(
  value: number | null | undefined,
  format: (amount: number) => string
): string {
  return value == null ? t().lib.meteredPrice.default : format(value);
}
