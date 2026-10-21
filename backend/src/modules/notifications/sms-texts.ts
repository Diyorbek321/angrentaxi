import type { AppLanguage } from '../../common/i18n/error-messages';

/** OTP kodi amal qilish muddati (daqiqa) — `auth.service.ts` shu bilan muddat qo'yadi. */
export const OTP_TTL_MINUTES = 5;

/**
 * Kirish kodi SMS'i. ⚠️ Eskiz faqat moderatsiyadan o'tgan shablon bo'yicha
 * yuboradi: matn o'zgarsa, Eskiz kabinetida shablonni ham yangilash kerak,
 * aks holda SMS ketmaydi. Ruscha shablon ham alohida moderatsiyadan o'tishi
 * kerak — shuning uchun ruscha faqat `ESKIZ_RU_TEMPLATE_APPROVED=true`
 * bo'lganda ishlatiladi (`smsLanguage`).
 */
export function otpSmsText(code: string, language: AppLanguage = 'uz'): string {
  if (language === 'ru') {
    return `Angren Taxi: ваш код подтверждения ${code}. Код действует ${OTP_TTL_MINUTES} минут.`;
  }
  return `Angren Taxi: tasdiqlash kodingiz ${code}. Kod ${OTP_TTL_MINUTES} daqiqa amal qiladi.`;
}

/**
 * SMS tili. Ruscha shablon Eskiz'da tasdiqlanmagan bo'lsa, ruscha so'ragan
 * foydalanuvchi ham o'zbekcha SMS oladi — aks holda SMS umuman ketmay,
 * kirib bo'lmay qolardi.
 */
export function smsLanguage(requested: AppLanguage | null, ruTemplateApproved: boolean): AppLanguage {
  return requested === 'ru' && ruTemplateApproved ? 'ru' : 'uz';
}
