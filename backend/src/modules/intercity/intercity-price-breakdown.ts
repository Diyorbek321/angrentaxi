import { FareBreakdown, IntercityExtensionCharge } from '../tariffs/fare-breakdown';

export interface IntercityPriceBreakdown {
  /** Qat'iy narx (nuqtadan nuqtagacha). */
  basePrice: number;
  /** "Shahar ichiga davom" qatorlari; bo'sh — davom yo'q. */
  extensions: IntercityExtensionCharge[];
}

/**
 * Bandning muzlatilgan `fare_breakdown` idan narx tarkibi. Davom paydo
 * bo'lishidan oldingi bandlarda `intercityExtensions` yo'q — asosiy narx
 * butun summa.
 */
export function intercityPriceBreakdown(
  fare: Pick<FareBreakdown, 'baseFare' | 'intercityExtensions'> | null | undefined,
  totalPrice: number,
): IntercityPriceBreakdown {
  return {
    basePrice: fare?.baseFare ?? totalPrice,
    extensions: fare?.intercityExtensions ?? [],
  };
}
