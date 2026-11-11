import { Tariff } from '../../database/entities/tariff.entity';

/**
 * Narx hisoblanadigan tarif — taksometrli safarda km narxi
 * [Tariff.meteredPricePerKm] bilan almashtiriladi (biznes qarori,
 * 2026-10-09: manzilsiz safarda km biroz qimmatroq). Qolgan stavkalar —
 * boshlang'ich, daqiqa, eng kam/ko'p narx, kutish — o'sha-o'sha.
 *
 * Jonli hisoblagich ham (`orders-meter.service.ts`), yakuniy narx ham
 * (`orders-completion.service.ts`) SHU funksiyadan o'tadi: yo'lovchi
 * ekranda ko'rgan raqam undiriladigan raqam bilan bir xil bo'lishi shart.
 */
export function meteredTariff(tariff: Tariff, isMetered: boolean): Tariff {
  if (!isMetered || tariff.meteredPricePerKm == null) return tariff;
  return { ...tariff, pricePerKm: tariff.meteredPricePerKm };
}
