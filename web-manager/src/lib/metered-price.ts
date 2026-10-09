import { z } from 'zod';

/**
 * Taksometr (manzilsiz safar) km narxi — ixtiyoriy maydon. Bo'sh qoldirilsa
 * `null`: backend shu tarifning oddiy km narxini ishlatadi
 * (`backend/src/modules/tariffs/metered-rate.ts`).
 *
 * `z.coerce.number()` bo'sh satrni 0 ga aylantiradi — bu yerda 0 "taksometr
 * bepul" degani bo'lib qolardi, shuning uchun bo'sh qiymat avval `null`ga
 * o'giriladi.
 */
export const meteredPriceField = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? null : value),
  z.coerce
    .number({ invalid_type_error: 'Raqam kiriting' })
    .min(0, "Manfiy bo'lmasin")
    .nullable()
);

/** Tarif kartasidagi qiymat: o'rnatilmagan bo'lsa oddiy km narxi amal qiladi. */
export function meteredPriceLabel(
  value: number | null | undefined,
  format: (amount: number) => string
): string {
  return value == null ? 'Oddiy km narxi' : format(value);
}
