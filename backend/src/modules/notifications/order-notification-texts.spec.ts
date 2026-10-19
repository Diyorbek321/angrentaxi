import { NO_DRIVERS_CANCEL_REASON } from '../matching/matching.constants';
import {
  driverArrivedText,
  newOrderOfferText,
  orderAcceptedText,
  orderCancelledText,
  tripCompletedText,
} from './order-notification-texts';
import { otpSmsText } from './sms-texts';

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

describe('OTP SMS', () => {
  it("o'zbekcha, kod va muddat bilan", () => {
    expect(otpSmsText('123456')).toBe('Angren Taxi: tasdiqlash kodingiz 123456. Kod 5 daqiqa amal qiladi.');
  });
});
