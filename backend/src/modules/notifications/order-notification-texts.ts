import { formatSom } from '../delivery/vendor-wallet-settlement';
import { NO_DRIVERS_CANCEL_REASON } from '../matching/matching.constants';

/**
 * Taksi buyurtmasi pushlarining matnlari — o'zbekcha, boshqa pushlar
 * (shaharlararo, hamyon, bonus) bilan bir xil tilda. Bildirishnoma jurnaliga
 * (`notification_log`) ham aynan shu matn yoziladi.
 */
export interface PushText {
  title: string;
  body: string;
}

/**
 * Bazaga yoziladigan tizim sabab kodlari → foydalanuvchi matni.
 * ⚠️ Kodning o'zi O'ZGARMAYDI: surge va hisobotlar `cancel_reason` ni aynan
 * shu qiymat bo'yicha qidiradi — faqat pushda tarjima qilinadi.
 */
const SYSTEM_CANCEL_REASONS: Readonly<Record<string, string>> = {
  [NO_DRIVERS_CANCEL_REASON]: "yaqin atrofda bo'sh haydovchi topilmadi",
};

export function orderAcceptedText(driver: { firstName?: string | null; lastName?: string | null } | undefined): PushText {
  const name = [driver?.firstName, driver?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return {
    title: 'Haydovchi topildi',
    body: `${name || 'Haydovchi'} sizni olib ketish uchun yo'lga chiqdi`,
  };
}

export function driverArrivedText(): PushText {
  return { title: 'Haydovchi yetib keldi', body: 'Haydovchi olish joyida sizni kutmoqda' };
}

export function tripCompletedText(finalPrice: number): PushText {
  return { title: 'Safar yakunlandi', body: `Safaringiz yakunlandi. Jami: ${formatSom(finalPrice)} so'm` };
}

export function newOrderOfferText(pickupAddress: string | null | undefined): PushText {
  return { title: 'Yangi buyurtma', body: `Olish joyi: ${pickupAddress?.trim() || 'yaqin atrofda'}` };
}

export function orderCancelledText(reason: string | null | undefined): PushText {
  const trimmed = reason?.trim();
  if (!trimmed) return { title: 'Buyurtma bekor qilindi', body: 'Buyurtmangiz bekor qilindi' };
  return {
    title: 'Buyurtma bekor qilindi',
    body: `Buyurtma bekor qilindi. Sabab: ${SYSTEM_CANCEL_REASONS[trimmed] ?? trimmed}`,
  };
}
