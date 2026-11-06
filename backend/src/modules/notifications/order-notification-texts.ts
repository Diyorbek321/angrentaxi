import { formatSom } from '../delivery/vendor-wallet-settlement';
import { NO_DRIVERS_CANCEL_REASON } from '../matching/matching.constants';
import type { AppLanguage } from '../../common/i18n/error-messages';
import type { PushText } from './push-text';

export type { PushText } from './push-text';

/**
 * Taksi buyurtmasi pushlarining matnlari — o'zbekcha (standart) va ruscha,
 * qabul qiluvchining tilida (`users.language`). Bildirishnoma jurnaliga
 * (`notification_log`) ham aynan shu matn yoziladi.
 */

/**
 * Bazaga yoziladigan tizim sabab kodlari → foydalanuvchi matni.
 * ⚠️ Kodning o'zi O'ZGARMAYDI: surge va hisobotlar `cancel_reason` ni aynan
 * shu qiymat bo'yicha qidiradi — faqat pushda tarjima qilinadi.
 */
const SYSTEM_CANCEL_REASONS: Readonly<Record<string, Record<AppLanguage, string>>> = {
  [NO_DRIVERS_CANCEL_REASON]: {
    uz: "yaqin atrofda bo'sh haydovchi topilmadi",
    ru: 'поблизости нет свободных водителей',
  },
};

export function orderAcceptedText(
  driver: { firstName?: string | null; lastName?: string | null } | undefined,
  language: AppLanguage = 'uz',
): PushText {
  const name = [driver?.firstName, driver?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  if (language === 'ru') {
    return { title: 'Водитель найден', body: `${name || 'Водитель'} едет к вам` };
  }
  return {
    title: 'Haydovchi topildi',
    body: `${name || 'Haydovchi'} sizni olib ketish uchun yo'lga chiqdi`,
  };
}

export function driverArrivedText(language: AppLanguage = 'uz'): PushText {
  if (language === 'ru') {
    return { title: 'Водитель на месте', body: 'Водитель ждёт вас в точке посадки' };
  }
  return { title: 'Haydovchi yetib keldi', body: 'Haydovchi olish joyida sizni kutmoqda' };
}

export function tripCompletedText(finalPrice: number, language: AppLanguage = 'uz'): PushText {
  if (language === 'ru') {
    return { title: 'Поездка завершена', body: `Поездка завершена. Итого: ${formatSom(finalPrice)} сум` };
  }
  return { title: 'Safar yakunlandi', body: `Safaringiz yakunlandi. Jami: ${formatSom(finalPrice)} so'm` };
}

export function newOrderOfferText(
  pickupAddress: string | null | undefined,
  language: AppLanguage = 'uz',
): PushText {
  const address = pickupAddress?.trim();
  if (language === 'ru') {
    return { title: 'Новый заказ', body: `Точка посадки: ${address || 'рядом с вами'}` };
  }
  return { title: 'Yangi buyurtma', body: `Olish joyi: ${address || 'yaqin atrofda'}` };
}

export function orderCancelledText(
  reason: string | null | undefined,
  language: AppLanguage = 'uz',
): PushText {
  const trimmed = reason?.trim();
  const ru = language === 'ru';
  const title = ru ? 'Заказ отменён' : 'Buyurtma bekor qilindi';
  if (!trimmed) return { title, body: ru ? 'Ваш заказ отменён' : 'Buyurtmangiz bekor qilindi' };
  const shown = SYSTEM_CANCEL_REASONS[trimmed]?.[language] ?? trimmed;
  return {
    title,
    body: ru ? `Заказ отменён. Причина: ${shown}` : `Buyurtma bekor qilindi. Sabab: ${shown}`,
  };
}
