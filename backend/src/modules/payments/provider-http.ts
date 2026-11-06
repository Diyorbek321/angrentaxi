/**
 * To'lov provayderiga (Payme, Uzcard) chiquvchi HTTP so'rovlar uchun timeout.
 * Usiz osilgan provayder so'rovni cheksiz ushlab turardi: foydalanuvchi
 * ekranda kutib qolardi, server ulanishlari esa to'planardi. Timeout —
 * oddiy tarmoq xatosi kabi, chaqiruvchi uni "tasdiqlanmadi" deb qaytaradi.
 */
export const PAYMENT_PROVIDER_TIMEOUT_MS = 10_000;
