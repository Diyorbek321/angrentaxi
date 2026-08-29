import { FareBreakdown } from './fare-breakdown';

/**
 * KUTISH HAQI — qoidaning YAGONA manbasi.
 *
 * Ilgari kutish faqat haydovchi ilovasidagi lokal hisoblagich edi: ekran
 * ochilganda boshlanardi, ilova qayta ishga tushsa nolga qaytardi va
 * yo'lovchi uni UMUMAN ko'rmasdi. Ya'ni ikki tomon har xil raqam ko'rardi va
 * bu raqamning hech qanday pulga aloqasi yo'q edi.
 *
 * Endi hisob SERVER tomonda: `orders.arrived_at` — haydovchi kelgan lahza,
 * tarif esa bepul daqiqa va daqiqa narxini beradi. Mobil ilovalar SHU
 * manbadan hisoblaydi, o'zining soatidan emas.
 *
 * ⚠️ BIZNES QARORI: kutish haqi HAR DOIM undiriladi — QAT'IY NARX
 * KAFOLATIDAN TASHQARI. Ya'ni yo'lovchi manzilni oldindan belgilagan va
 * unga aniq summa ko'rsatilgan bo'lsa ham, kutish uchun alohida to'laydi.
 * Sababi: qat'iy narx MARSHRUT noaniqligini yopadi (tirbandlik, uzunroq
 * yo'l — buni haydovchi boshqarmaydi), kutish esa YO'LOVCHI boshqaradigan
 * narsa. Uni kafolat ichiga kiritish haydovchini yo'lovchining kechikishi
 * uchun jazolardi.
 */

/**
 * Bepul kutish, daqiqa. Yo'lovchi chiqib ulgurishi uchun oqilona oyna —
 * haydovchi kelganini bosgan zahoti hisoblagich pul yeya boshlamaydi.
 *
 * ⚠️ Bu qiymatlar `009_waiting_charge.ts` migratsiyasida ustun DEFAULT'i
 * sifatida MUZLATILGAN. Bu yerda o'zgartirilsa, migratsiya o'zgarmaydi
 * (o'tmish yozuvi o'zgarmasligi kerak) — yangi qiymat faqat ustun bo'sh
 * kelgan holatlar uchun zaxira bo'lib qoladi.
 */
export const DEFAULT_FREE_WAIT_MINUTES = 3;

/** Bepul oynadan keyingi har bir daqiqa narxi, so'm. */
export const DEFAULT_WAITING_PRICE_PER_MINUTE = 500;

const MS_PER_MINUTE = 60_000;

/**
 * Tarifdan kutish sozlamalarini xavfsiz o'qish.
 *
 * ⚠️ ORQAGA MOSLIK: migratsiyadan oldin yaratilgan tarif obyektlari (va
 * testlardagi qisqartirilgan tarif literallari) bu maydonlarsiz keladi.
 * Ular `undefined` bo'lsa standart qiymat ishlatiladi — `NaN` narxga
 * aylanib ketmasligi uchun. Bu `tariff.surgeMultiplier ?? 1.0` bilan bir xil
 * himoya naqshi.
 */
export function waitingSettingsOf(tariff: {
  freeWaitMinutes?: number | null;
  waitingPricePerMinute?: number | null;
}): { freeWaitMinutes: number; waitingPricePerMinute: number } {
  return {
    freeWaitMinutes: tariff.freeWaitMinutes ?? DEFAULT_FREE_WAIT_MINUTES,
    waitingPricePerMinute:
      tariff.waitingPricePerMinute ?? DEFAULT_WAITING_PRICE_PER_MINUTE,
  };
}

/**
 * HAQ OLINADIGAN kutish daqiqalari.
 *
 * Oyna: `arrivedAt` (haydovchi kelganini belgilagan lahza) → `tripStartedAt`
 * (safar boshlangan lahza). Safar boshlangach kutish TUGAYDI — undan keyingi
 * vaqt yo'l vaqti bo'lib, `timeFare` da alohida hisoblanadi. Ikki marta
 * undirilmaydi.
 *
 * ⚠️ YAXLITLASH QOIDASI — BOSHLANGAN DAQIQA TO'LIQ HISOBLANADI:
 *
 *     haqli = max(0, ceil(o'tgan_vaqt_daqiqada) - bepul_daqiqa)
 *
 * Ya'ni 3:00.000 — hali bepul; 3:00.001 dan boshlab to'rtinchi daqiqa
 * BOSHLANGAN deb qaraladi va to'liq undiriladi (500 so'm). 7:10 kutish =
 * ceil(7.17) = 8, 8 - 3 = 5 daqiqa = 2500 so'm.
 *
 * NEGA yuqoriga yaxlitlanadi: taksi hisoblagichlarining odatiy qoidasi shu,
 * va u loyihaning mavjud naqshi bilan mos — safar davomiyligi ham
 * `orders-completion.service.ts` da `Math.ceil` bilan olinadi. Ikki xil
 * yaxlitlash bo'lsa chekdagi ikki qator ikki xil mantiqdan chiqardi.
 *
 * ⚠️ Bu AYNAN nizo chiqadigan joy, shuning uchun qoida bitta jumlada
 * aytiladi va yo'lovchi ilovasida ham shu so'zlar bilan ko'rsatiladi:
 * "birinchi 3 daqiqa bepul, keyin har boshlangan daqiqa uchun 500 so'm".
 *
 * @param arrivedAt      haydovchi kelgan lahza; `null` — ESKI buyurtma yoki
 *                       haydovchi "keldim" bosmagan → kutish 0.
 * @param tripStartedAt  safar boshlangan lahza; `null` — safar yozuvi yo'q,
 *                       kutish oynasini yopib bo'lmaydi → 0 (hech qachon
 *                       ortiqcha undirmaymiz).
 */
export function computeWaitingMinutes(
  arrivedAt: Date | string | null | undefined,
  tripStartedAt: Date | string | null | undefined,
  freeWaitMinutes: number,
): number {
  if (arrivedAt == null || tripStartedAt == null) {
    return 0;
  }

  const arrivedMs = new Date(arrivedAt).getTime();
  const startedMs = new Date(tripStartedAt).getTime();

  // Yaroqsiz sana (buzuq qator, noto'g'ri matn) — kutish yo'q deb qaraladi.
  // `NaN` narxga aylanib ketishidan ko'ra nol yaxshiroq.
  if (Number.isNaN(arrivedMs) || Number.isNaN(startedMs)) {
    return 0;
  }

  // Soat farqi yoki qo'lda tuzatilgan yozuv `startedMs < arrivedMs` berishi
  // mumkin — manfiy daqiqa yo'lovchiga chegirma bo'lib qolardi.
  const elapsedMinutes = Math.max(0, startedMs - arrivedMs) / MS_PER_MINUTE;

  return Math.max(0, Math.ceil(elapsedMinutes) - freeWaitMinutes);
}

/**
 * Mavjud narx tarkibiga kutish qatorini QO'SHIB, YANGI tarkib qaytaradi.
 *
 * Kirish obyekti O'ZGARTIRILMAYDI: `order.fareBreakdown` — buyurtma
 * yaratilganda muzlatilgan quote, uni joyida o'zgartirish o'sha yozuvni
 * buzardi.
 *
 * ⚠️ KUTISH CHEGARADAN TASHQARIDA. Qator `maxPriceCap` dan KEYIN qo'shiladi,
 * ya'ni tarifning yuqori chegarasi ham, koeffitsient ham unga tegmaydi.
 * Aks holda `maxPrice` ga yetgan safarda kutish bepul bo'lib qolardi — ya'ni
 * eng uzoq kutilgan safarlarda aynan haq undirilmasdi.
 *
 * ⚠️ IDEMPOTENT: agar tarkibda kutish qatori allaqachon bo'lsa, u jamidan
 * ayirilib, yangisi qo'yiladi. Shu sababli funksiyani ikki marta qo'llash
 * narxni ikki barobar oshirmaydi.
 *
 * INVARIANT (kengaytirilgan):
 *   baseFare + distanceFare + timeFare + minPriceAdjustment
 *     + surgeFare + maxPriceCap + waitingFare === total
 */
export function withWaitingFare(
  breakdown: FareBreakdown,
  waitingMinutes: number,
  waitingPricePerMinute: number,
): FareBreakdown {
  // ⚠️ ESKI TARKIBLAR: migratsiyadan oldin yozilgan `fare_breakdown` jsonb
  // qatorlarida bu maydonlar YO'Q. `?? 0` ularni "kutishsiz" deb o'qiydi.
  const previousWaitingFare = breakdown.waitingFare ?? 0;

  // Ikkalasi ham butun son (daqiqa × so'm), shuning uchun float xatosi
  // umuman paydo bo'lmaydi — pul qiymati aniq butun so'mda qoladi.
  const waitingFare = waitingMinutes * waitingPricePerMinute;

  return {
    ...breakdown,
    waitingMinutes,
    waitingFare,
    total: breakdown.total - previousWaitingFare + waitingFare,
  };
}
