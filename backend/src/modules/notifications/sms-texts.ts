/** OTP kodi amal qilish muddati (daqiqa) — `auth.service.ts` shu bilan muddat qo'yadi. */
export const OTP_TTL_MINUTES = 5;

/**
 * Kirish kodi SMS'i. ⚠️ Eskiz faqat moderatsiyadan o'tgan shablon bo'yicha
 * yuboradi: matn o'zgarsa, Eskiz kabinetida shablonni ham yangilash kerak,
 * aks holda SMS ketmaydi.
 */
export function otpSmsText(code: string): string {
  return `Angren Taxi: tasdiqlash kodingiz ${code}. Kod ${OTP_TTL_MINUTES} daqiqa amal qiladi.`;
}
