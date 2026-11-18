/**
 * Safar uchun amaldagi komissiya stavkasi (foiz) — sof funksiya.
 *
 * Mavjud qoida (o'zgarmagan): haydovchining shaxsiy stavkasi bo'lsa — u,
 * aks holda platforma standarti (`platform_settings.default_commission_rate`,
 * standart 10%).
 *
 * Ishga tushirish aksiyasi (`launchPromoCommissionUntil`): `now` shu sanadan
 * OLDIN bo'lsa, TAKSI safarlari uchun stavka `LAUNCH_PROMO_COMMISSION_RATE`
 * (0%). Shaxsiy stavka faqat undan PAST bo'lsa yutadi — ya'ni amalda hech
 * qachon, lekin aksiya stavkasi keyin o'zgartirilsa qoida to'g'ri qoladi.
 * Yuk, posilka va yetkazish aksiyaga kirmaydi: aksiya taksi haydovchilarini
 * jalb qilish uchun.
 *
 * Smena (kunlik obuna, `modules/shift-passes`): haydovchi safar yakunlangan
 * paytni va safar xizmat turini qamragan faol smenaga ega bo'lsa — stavka
 * `SHIFT_PASS_COMMISSION_RATE` (0%). Smena qamrovini (vaqt + xizmat turi)
 * CHAQIRUVCHI aniqlaydi va `shiftPassActive` ni uzatadi.
 *
 * USTUVORLIK (yuqoridan pastga, birinchi mos kelgani yutadi):
 *   1. faol smena            → 0% (smena narxi bu safar uchun allaqachon to'langan)
 *   2. ishga tushirish aksiyasi (faqat taksi) → min(shaxsiy stavka, 0%)
 *   3. haydovchining shaxsiy stavkasi
 *   4. platforma standarti (10%)
 * 1% soliq ushlab qolish bu qoidadan TASHQARIDA — u haydovchining solig'i,
 * platforma daromadi emas, smena yoki aksiya uni o'chirmaydi.
 */
import { ServiceType } from '../../database/entities/order.entity';
import { applyDiscount } from '../tariffs/fare-rounding';

export const LAUNCH_PROMO_COMMISSION_RATE = 0;
export const SHIFT_PASS_COMMISSION_RATE = 0;

export interface CommissionRateInput {
  serviceType: ServiceType;
  driverRate: number | null;
  defaultRate: number;
  launchPromoUntil: Date | null;
  now: Date;
  /** Haydovchida shu safarni qamragan faol smena bor (standart: yo'q). */
  shiftPassActive?: boolean;
}

export function isLaunchPromoActive(launchPromoUntil: Date | null, now: Date): boolean {
  return launchPromoUntil != null && now.getTime() < launchPromoUntil.getTime();
}

export function resolveCommissionRate(input: CommissionRateInput): number {
  if (input.shiftPassActive === true) {
    return SHIFT_PASS_COMMISSION_RATE;
  }
  const regular = input.driverRate ?? input.defaultRate;
  const promoApplies =
    input.serviceType === ServiceType.TAXI && isLaunchPromoActive(input.launchPromoUntil, input.now);
  if (!promoApplies) {
    return regular;
  }
  return input.driverRate != null
    ? Math.min(input.driverRate, LAUNCH_PROMO_COMMISSION_RATE)
    : LAUNCH_PROMO_COMMISSION_RATE;
}

/**
 * Safar pulining taqsimoti — promokod chegirmasini PLATFORMA ko'taradi
 * (biznes qarori, 2026-10-16; ovqat/market bilan bir xil model —
 * `delivery/promo-compensation.ts`, docs/LEGAL-COMPLIANCE.md §26).
 *
 *  · yo'lovchi chegirmali, 100 so'mga yaxlitlangan summani to'laydi;
 *  · komissiya (va 1% soliq) CHEGIRMASIZ narxdan — haydovchi daromadi
 *    promokodli va promokodsiz safarda bir xil;
 *  · naqdda haydovchi qo'liga kam oladi, farqni platforma hamyoniga
 *    qoplaydi (`promoCompensation`), naqd bo'lmaganda esa haydovchiga
 *    to'liq narx CREDIT qilinadi.
 */
export interface RideFareSplit {
  /** Chegirmasiz yo'l haqi — komissiya, soliq va haydovchi CREDIT'i bazasi. */
  grossFare: number;
  /** Yo'lovchi to'laydigan summa (`order.finalPrice`, chek jami). */
  passengerPays: number;
  /** Yaxlitlashdan keyingi haqiqiy chegirma: `grossFare − passengerPays`. */
  discountAmount: number;
  commissionAmount: number;
  /** `grossFare − commissionAmount` (`order.driverEarning`). */
  driverEarning: number;
}

/**
 * Safarning komissiya va 1% soliq olingan BAZASI — haydovchi yalpi daromadi
 * (daromad ekrani va soliq hisoboti). `o` — `orders`, `commissionAlias` —
 * shu buyurtmaning `'commission'` daftar qatori (LEFT JOIN).
 *
 * ⚠️ NEGA `final_price + discount_amount` emas: promo kodni platforma
 * to'lashidan (§26a) OLDINGI safarlarda baza chegirmali narx edi. `driver_earning
 * + komissiya` ikkala davrda ham aynan o'sha bazani beradi, o'tgan oylar
 * hisobotida esa ushlangan soliq bilan mos qoladi. Komissiyasiz safarda qator
 * yo'q (0). `driver_earning` yo'q eng eski qatorlar — `final_price`.
 */
export function driverGrossFareSql(commissionAlias: string): string {
  return `COALESCE(o.driver_earning + COALESCE(${commissionAlias}.amount, 0), o.final_price, o.estimated_price)`;
}

export function splitRideFare(grossFare: number, discount: number, commissionRate: number): RideFareSplit {
  const discounted = applyDiscount(grossFare, discount);
  const commissionAmount = Math.round((grossFare * commissionRate) / 100);
  return {
    grossFare,
    passengerPays: discounted.finalPrice,
    discountAmount: discounted.discountAmount,
    commissionAmount,
    driverEarning: grossFare - commissionAmount,
  };
}
