import { NO_DRIVERS_CANCEL_REASON } from '../matching/matching.constants';
import {
  driverArrivedText,
  newOrderOfferText,
  orderAcceptedText,
  orderCancelledText,
  tripCompletedText,
} from './order-notification-texts';
import { otpSmsText, smsLanguage } from './sms-texts';
import {
  bonusAwardedText,
  lostItemAnsweredText,
  supportReplyText,
  vendorOrderCancelledText,
  verificationDueText,
} from './misc-notification-texts';
import { localized, userLanguage } from './push-text';
import { intercityPush } from '../intercity/intercity-push-texts';

describe("Buyurtma pushlari — o'zbekcha matnlar", () => {
  it('haydovchi topildi: ism bilan, ism bo\'lmasa "Haydovchi"', () => {
    expect(orderAcceptedText({ firstName: 'Botir', lastName: 'Karimov' })).toEqual({
      title: 'Haydovchi topildi',
      body: "Botir Karimov sizni olib ketish uchun yo'lga chiqdi",
    });
    expect(orderAcceptedText({ firstName: null, lastName: '  ' }).body).toBe(
      "Haydovchi sizni olib ketish uchun yo'lga chiqdi",
    );
    expect(orderAcceptedText(undefined).body).toBe("Haydovchi sizni olib ketish uchun yo'lga chiqdi");
  });

  it('haydovchi yetib keldi', () => {
    expect(driverArrivedText()).toEqual({
      title: 'Haydovchi yetib keldi',
      body: 'Haydovchi olish joyida sizni kutmoqda',
    });
  });

  it("safar yakunlandi: summa bo'shliq bilan ajratilgan va so'm", () => {
    expect(tripCompletedText(25000)).toEqual({
      title: 'Safar yakunlandi',
      body: "Safaringiz yakunlandi. Jami: 25 000 so'm",
    });
  });

  it("yangi buyurtma: olish manzili, manzil yo'q bo'lsa — yaqin atrof", () => {
    expect(newOrderOfferText('Navoiy 12')).toEqual({
      title: 'Yangi buyurtma',
      body: 'Olish joyi: Navoiy 12',
    });
    expect(newOrderOfferText(null).body).toBe('Olish joyi: yaqin atrofda');
    expect(newOrderOfferText('   ').body).toBe('Olish joyi: yaqin atrofda');
  });

  it('bekor qilindi: sabab bilan va sababsiz', () => {
    expect(orderCancelledText('Haydovchi juda uzoq')).toEqual({
      title: 'Buyurtma bekor qilindi',
      body: 'Buyurtma bekor qilindi. Sabab: Haydovchi juda uzoq',
    });
    expect(orderCancelledText(undefined).body).toBe('Buyurtmangiz bekor qilindi');
    expect(orderCancelledText('  ').body).toBe('Buyurtmangiz bekor qilindi');
  });

  it("tizim sabab kodi ('No drivers available') pushda o'zbekcha ko'rinadi", () => {
    expect(orderCancelledText(NO_DRIVERS_CANCEL_REASON).body).toBe(
      "Buyurtma bekor qilindi. Sabab: yaqin atrofda bo'sh haydovchi topilmadi",
    );
  });
});

describe('Buyurtma pushlari — ruscha matnlar', () => {
  it('har bir taksi pushi ruscha', () => {
    expect(orderAcceptedText({ firstName: 'Botir', lastName: null }, 'ru')).toEqual({
      title: 'Водитель найден',
      body: 'Botir едет к вам',
    });
    expect(orderAcceptedText(undefined, 'ru').body).toBe('Водитель едет к вам');
    expect(driverArrivedText('ru').title).toBe('Водитель на месте');
    expect(tripCompletedText(25000, 'ru').body).toBe('Поездка завершена. Итого: 25 000 сум');
    expect(newOrderOfferText(null, 'ru').body).toBe('Точка посадки: рядом с вами');
    expect(orderCancelledText(undefined, 'ru')).toEqual({ title: 'Заказ отменён', body: 'Ваш заказ отменён' });
  });

  it("tizim sabab kodi ruschaga tarjima qilinadi, erkin sabab — o'zgarmaydi", () => {
    expect(orderCancelledText(NO_DRIVERS_CANCEL_REASON, 'ru').body).toBe(
      'Заказ отменён. Причина: поблизости нет свободных водителей',
    );
    expect(orderCancelledText('Passajir kelmadi', 'ru').body).toBe('Заказ отменён. Причина: Passajir kelmadi');
  });

  it("boshqa pushlar ham ikki tilda", () => {
    expect(lostItemAnsweredText(false, 'ru').body).toBe('Водитель не нашёл вашу вещь в машине.');
    expect(supportReplyText('ru').title).toBe('Служба поддержки');
    expect(bonusAwardedText('10 safar', 25000, 'ru').body).toMatch(/^10 safar: 25\s000 сум зачислено на ваш счёт$/);
    expect(verificationDueText(['Tibbiy maʼlumotnoma'], true, 'ru').title).toBe('Срок проверки истёк');
    expect(verificationDueText(['Litsenziya'], false).title).toBe('Tekshiruv muddati yaqinlashdi');
    expect(vendorOrderCancelledText(null, 'ru').body).toBe('Клиент отменил заказ');
  });
});

describe('Shaharlararo pushlari', () => {
  it("o'zbekcha matn avvalgidek, ruschada joy soni to'g'ri kelishikda", () => {
    expect(intercityPush.bookingCreated(false, 2, '14:00')('uz')).toEqual({
      title: 'Yangi band: 2 joy',
      body: "14:00 dagi qatnovingizga yo'lovchi yozildi",
    });
    expect(intercityPush.bookingCreated(false, 1, '14:00')('ru').title).toBe('Новая бронь: 1 место');
    expect(intercityPush.bookingCreated(false, 3, '14:00')('ru').title).toBe('Новая бронь: 3 места');
    expect(intercityPush.bookingCreated(false, 5, '14:00')('ru').title).toBe('Новая бронь: 5 мест');
    expect(intercityPush.bookingCancelled(true, 4, '09:30')('uz').body).toBe("Butun mashina bo'shadi — 09:30 dagi qatnov");
    expect(intercityPush.bookingCancelled(true, 4, '09:30')('ru').body).toBe('Вся машина освободилось — рейс в 09:30');
  });
});

describe('push-text', () => {
  it("noma'lum til o'zbekchaga tushadi", () => {
    expect(userLanguage({ language: 'ru' })).toBe('ru');
    expect(userLanguage({ language: 'en' })).toBe('uz');
    expect(userLanguage(null)).toBe('uz');
    const text = localized({ uz: { title: 'a', body: 'b' }, ru: { title: 'в', body: 'г' } });
    expect(text('ru').title).toBe('в');
  });
});

describe('OTP SMS', () => {
  it("o'zbekcha, kod va muddat bilan", () => {
    expect(otpSmsText('123456')).toBe('Angren Taxi: tasdiqlash kodingiz 123456. Kod 5 daqiqa amal qiladi.');
  });

  it('ruscha matn', () => {
    expect(otpSmsText('123456', 'ru')).toBe('Angren Taxi: ваш код подтверждения 123456. Код действует 5 минут.');
  });

  it("ruscha faqat Eskiz shabloni tasdiqlangach — aks holda o'zbekcha (SMS umuman ketmay qolmasin)", () => {
    expect(smsLanguage('ru', false)).toBe('uz');
    expect(smsLanguage('ru', true)).toBe('ru');
    expect(smsLanguage(null, true)).toBe('uz');
    expect(smsLanguage('uz', true)).toBe('uz');
  });
});
