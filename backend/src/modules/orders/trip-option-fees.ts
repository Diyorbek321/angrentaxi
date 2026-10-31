import { FareBreakdown, TripOptionCharge } from '../tariffs/fare-breakdown';
import { withRounding } from '../tariffs/fare-rounding';
import { TripOption } from './trip-options';

/**
 * SAFAR OPSIYALARI HAQI (biznes qarori, 2026-10-09).
 *
 * Bola o'rindig'i, hayvon va h.k. uchun qo'shimcha haqni MENEJER belgilaydi
 * (`platform_settings.trip_option_fees`, migratsiya 023). Haq butun shahar
 * uchun bitta — tarifga bog'liq emas: o'rindiq Start'da ham, Biznes'da ham
 * bir xil o'rindiq.
 *
 * Haq buyurtma berilgan lahzada quote'ga MUZLATILADI (`optionCharges`).
 * Safar yakunida va jonli hisoblagichda o'sha muzlatilgan qatorlar
 * ishlatiladi — sozlama keyin o'zgarsa, yo'lovchi ko'rgan summa o'zgarmaydi.
 */
export type TripOptionFees = Partial<Record<TripOption, number>>;

/** jsonb'dan kelgan qiymatni tozalaydi: faqat ma'lum opsiya va musbat son. */
export function normalizeTripOptionFees(raw: unknown): TripOptionFees {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const fees: TripOptionFees = {};
  for (const option of Object.values(TripOption)) {
    const fee = source[option];
    if (typeof fee === 'number' && Number.isFinite(fee) && fee > 0) fees[option] = fee;
  }
  return fees;
}

/** So'ralgan opsiyalardan haqi borlarini chek qatorlariga aylantiradi. */
export function tripOptionCharges(
  options: readonly string[] | null | undefined,
  fees: TripOptionFees,
): TripOptionCharge[] {
  if (!options || options.length === 0) return [];
  const wanted = new Set(options);
  return (Object.values(TripOption) as TripOption[])
    .filter((option) => wanted.has(option) && (fees[option] ?? 0) > 0)
    .map((option) => ({ option, fee: fees[option]! }));
}

/**
 * Opsiya haqini tarkibga qo'shadi — `withWaitingFare` bilan bir xil qoida.
 *
 * ⚠️ CHEGARADAN TASHQARIDA: `maxPriceCap` dan keyin qo'shiladi. Aks holda
 * yuqori chegaraga yetgan uzoq safarda bola o'rindig'i bepul bo'lib qolardi.
 *
 * IDEMPOTENT: avvalgi opsiya qatori jamidan ayirilib, yangisi qo'yiladi.
 * Kirish obyekti o'zgartirilmaydi.
 */
export function withOptionsFare(
  breakdown: FareBreakdown,
  charges: readonly TripOptionCharge[],
): FareBreakdown {
  const previousOptionsFare = breakdown.optionsFare ?? 0;
  const optionsFare = charges.reduce((sum, charge) => sum + charge.fee, 0);

  const withOptions: FareBreakdown = {
    ...breakdown,
    optionsFare,
    optionCharges: charges.map((charge) => ({ ...charge })),
    total: breakdown.total - previousOptionsFare + optionsFare,
  };

  // Haq yo'q bo'lsa jamiga tegilmaydi (kelishilgan yetkazish summasi
  // yaxlitlanmasligi kerak — `agreedFareBreakdown`).
  return optionsFare === 0 && previousOptionsFare === 0 ? withOptions : withRounding(withOptions);
}
