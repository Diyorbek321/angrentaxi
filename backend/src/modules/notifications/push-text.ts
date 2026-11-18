import type { AppLanguage } from '../../common/i18n/error-messages';

/**
 * Push matni. Har bir push qabul qiluvchining tilida (`users.language`)
 * yuboriladi va bildirishnoma jurnaliga (`notification_log`) ham shu tilda
 * yoziladi.
 */
export interface PushText {
  title: string;
  body: string;
}

/**
 * Tilga qarab matn beruvchi funksiya. Bir nechta qabul qiluvchiga ketadigan
 * pushlar (`notifyUserIds`) va chaqiruvchi matn tuzadigan pushlar
 * (`notifyWalletEvent`) shuni oladi — har foydalanuvchi o'z tilida oladi.
 */
export type LocalizedPush = (language: AppLanguage) => PushText;

/** O'zgaruvchisiz ikki tilli matn: `localized({ uz: {...}, ru: {...} })`. */
export function localized(texts: Record<AppLanguage, PushText>): LocalizedPush {
  return (language) => texts[language] ?? texts.uz;
}

/** Bazadagi qiymat ishonchsiz bo'lishi mumkin — noma'lum til o'zbekcha. */
export function userLanguage(user: { language?: string | null } | null | undefined): AppLanguage {
  return user?.language === 'ru' ? 'ru' : 'uz';
}
