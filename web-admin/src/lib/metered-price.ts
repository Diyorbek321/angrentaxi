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
 *
 * Xato matnlari `errorMap` orqali parse paytida olinadi — sxema modul
 * darajasida yasalsa ham joriy tilda chiqadi.
 */
export const meteredPriceField = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? null : value),
  z.coerce
    .number({
      errorMap: (issue) => {
        const v = t().finance.meteredPrice;
        return { message: issue.code === 'too_small' ? v.negative : v.enterNumber };
      },
    })
    .min(0)
    .nullable()
);

/** Tarif kartasidagi qiymat: o'rnatilmagan bo'lsa oddiy km narxi amal qiladi. */
export function meteredPriceLabel(
  value: number | null | undefined,
  format: (amount: number) => string
): string {
  return value == null ? t().finance.meteredPrice.defaultKm : format(value);
}
