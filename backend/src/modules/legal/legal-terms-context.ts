import { LegalContext, LegalLang } from '../account-deletion/legal-pages.content';
import { LegalPolicyNumbers } from './legal-policy';

/** Oferta sahifalari konteksti: maxfiylik konteksti + havolalar + raqamlar. */
export interface TermsContext extends LegalContext {
  termsUrl: string;
  driverTermsUrl: string;
  vendorTermsUrl: string;
  policy: LegalPolicyNumbers;
}

/** Har bir oferta sahifasining yuqorisidagi ogohlantirish. */
export function draftBanner(lang: LegalLang, version: string): string {
  return lang === 'ru'
    ? `ЧЕРНОВИК для проверки юристом — редакция ${version}. Текст ещё не утверждён; цифры — значения по умолчанию, которые устанавливает платформа (в приложении всегда показываются действующие).`
    : `QORALAMA — yurist ko'rib chiqishi uchun, tahrir ${version}. Matn hali tasdiqlanmagan; raqamlar — platforma belgilaydigan standart qiymatlar (ilovada har doim amaldagisi ko'rsatiladi).`;
}
