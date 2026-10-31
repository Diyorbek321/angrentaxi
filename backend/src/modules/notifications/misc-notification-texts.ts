import type { AppLanguage } from '../../common/i18n/error-messages';
import type { PushText } from './push-text';

/**
 * Taksi buyurtmasidan tashqari pushlar (yo'qolgan buyum, qo'llab-quvvatlash,
 * bonus, tekshiruv muddati, sotuvchiga bekor qilish) — o'zbekcha va ruscha.
 * Nega matnda aniq summa/ro'yxat turishi — `notifications.service.ts` dagi
 * izohlarda.
 */

export function lostItemReportedText(description: string, language: AppLanguage = 'uz'): PushText {
  if (language === 'ru') {
    return { title: 'Пассажир забыл вещь', body: `Проверьте машину: ${description}` };
  }
  return { title: "Yo'lovchi buyum qoldirgan", body: `Mashinangizni tekshiring: ${description}` };
}

export function lostItemAnsweredText(found: boolean, language: AppLanguage = 'uz'): PushText {
  if (language === 'ru') {
    return {
      title: 'Забытая вещь',
      body: found
        ? 'Водитель нашёл вашу вещь — оператор свяжется с вами и договорится о возврате.'
        : 'Водитель не нашёл вашу вещь в машине.',
    };
  }
  return {
    title: "Yo'qolgan buyum",
    body: found
      ? "Haydovchi buyumingizni topdi — operator siz bilan bog'lanib qaytarishni kelishadi."
      : 'Haydovchi mashinadan buyumingizni topmadi.',
  };
}

export function supportReplyText(language: AppLanguage = 'uz'): PushText {
  if (language === 'ru') {
    return { title: 'Служба поддержки', body: 'Новое сообщение от оператора' };
  }
  return { title: "Qo'llab-quvvatlash xizmati", body: 'Operatordan yangi xabar keldi' };
}

export function bonusAwardedText(bonusName: string, amount: number, language: AppLanguage = 'uz'): PushText {
  // `uz-UZ` guruhlash ikki tilda ham bir xil ("25 000") — ilova bilan mos.
  const sum = amount.toLocaleString('uz-UZ');
  if (language === 'ru') {
    return { title: 'Бонус зачислен', body: `${bonusName}: ${sum} сум зачислено на ваш счёт` };
  }
  return { title: 'Bonus hisobingizga tushdi', body: `${bonusName}: ${sum} so'm hisobingizga qo'shildi` };
}

export function verificationDueText(
  labels: readonly string[],
  hasOverdue: boolean,
  language: AppLanguage = 'uz',
): PushText {
  const listed = labels.join(', ');
  if (language === 'ru') {
    return hasOverdue
      ? {
          title: 'Срок проверки истёк',
          body: `${listed} — срок истёк. Пока не обновите, выйти на линию нельзя.`,
        }
      : { title: 'Срок проверки подходит', body: `${listed} — срок истекает. Пожалуйста, обновите.` };
  }
  return hasOverdue
    ? {
        title: 'Tekshiruv muddati o‘tdi',
        body: `${listed} — muddati o‘tgan. Yangilamasangiz onlayn chiqa olmaysiz.`,
      }
    : {
        title: 'Tekshiruv muddati yaqinlashdi',
        body: `${listed} — muddati tugayapti. Iltimos, yangilab qo‘ying.`,
      };
}

export function vendorOrderCancelledText(reason: string | null, language: AppLanguage = 'uz'): PushText {
  if (language === 'ru') {
    return {
      title: 'Заказ отменён',
      body: reason ? `Клиент отменил заказ: ${reason}` : 'Клиент отменил заказ',
    };
  }
  return {
    title: 'Buyurtma bekor qilindi',
    body: reason ? `Mijoz buyurtmani bekor qildi: ${reason}` : 'Mijoz buyurtmani bekor qildi',
  };
}
