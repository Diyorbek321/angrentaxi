import type { AppLanguage } from '../../common/i18n/error-messages';
import type { PushText } from './push-text';

/**
 * Yetkazish hodisalari pushlari (docs/INCIDENT-POLICY.md §2) — o'zbekcha va
 * ruscha. Mijoz ilovasi yopiq bo'lsa ham kuryer eshik oldida ekanini bilishi
 * shart: aks holda bepul kutish o'tib, buyurtma qaytarilib ketadi.
 */
export function courierAtDoorText(freeWaitMinutes: number, language: AppLanguage = 'uz'): PushText {
  if (language === 'ru') {
    return {
      title: 'Курьер у двери',
      body: `Курьер ждёт вас. Бесплатное ожидание — ${freeWaitMinutes} мин, затем платно. Назовите курьеру код из приложения.`,
    };
  }
  return {
    title: 'Kuryer eshik oldida',
    body: `Kuryer sizni kutmoqda. Bepul kutish — ${freeWaitMinutes} daqiqa, keyin pullik. Kuryerga ilovadagi kodni ayting.`,
  };
}

export function deliveryFailedCustomerText(language: AppLanguage = 'uz'): PushText {
  if (language === 'ru') {
    return {
      title: 'Доставка не состоялась',
      body: 'Курьер не смог передать заказ и возвращает его. Будут удержаны стоимость доставки и плата за возврат.',
    };
  }
  return {
    title: "Yetkazib bo'lmadi",
    body: "Kuryer buyurtmani topshira olmadi va uni qaytarmoqda. Yetkazish haqi va qaytarish haqi undiriladi.",
  };
}

export function deliveryFailedVendorText(language: AppLanguage = 'uz'): PushText {
  if (language === 'ru') {
    return {
      title: 'Заказ возвращается',
      body: 'Курьер не смог передать заказ — он везёт товар обратно. Подтвердите возврат, когда получите его.',
    };
  }
  return {
    title: 'Buyurtma qaytarilmoqda',
    body: "Kuryer buyurtmani topshira olmadi — tovarni qaytarib olib kelmoqda. Qabul qilgach «Qaytib keldi» ni bosing.",
  };
}

export function deliveryReturnedText(amount: number, language: AppLanguage = 'uz'): PushText {
  const sum = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (language === 'ru') {
    return { title: 'Заказ возвращён', body: `Заказ возвращён продавцу. К оплате за доставку и возврат: ${sum} сум.` };
  }
  return { title: 'Buyurtma qaytarildi', body: `Buyurtma sotuvchiga qaytarildi. Yetkazish va qaytarish uchun: ${sum} so'm.` };
}
