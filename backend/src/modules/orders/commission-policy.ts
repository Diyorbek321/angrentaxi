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
