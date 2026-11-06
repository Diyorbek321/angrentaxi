import type { LocalizedPush } from '../notifications/push-text';

/**
 * Shaharlararo push matnlari — o'zbekcha va ruscha, har qabul qiluvchiga o'z
 * tilida (`notifyUserIds`). Vaqtlar (`time`, `window`) chaqiruvchida Toshkent
 * vaqtida formatlanadi; haydovchi/dispetcher yozgan sabab tarjima qilinmaydi.
 */

/** "butun mashina" / "2 joy" — `capitalized` gap boshida. */
function seatsText(wholeCar: boolean, seats: number, ru: boolean, capitalized = false): string {
  if (wholeCar) {
    const text = ru ? 'вся машина' : 'butun mashina';
    return capitalized ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }
  return ru ? `${seats} ${ruSeatWord(seats)}` : `${seats} joy`;
}

/** 1 место, 2 места, 5 мест, 21 место. */
function ruSeatWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'место';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'места';
  return 'мест';
}

export const intercityPush = {
  bookingCreated:
    (wholeCar: boolean, seats: number, time: string): LocalizedPush =>
    (lang) =>
      lang === 'ru'
        ? { title: `Новая бронь: ${seatsText(wholeCar, seats, true)}`, body: `На ваш рейс в ${time} записался пассажир` }
        : {
            title: `Yangi band: ${seatsText(wholeCar, seats, false)}`,
            body: `${time} dagi qatnovingizga yo'lovchi yozildi`,
          },

  bookingCancelled:
    (wholeCar: boolean, seats: number, time: string): LocalizedPush =>
    (lang) =>
      lang === 'ru'
        ? { title: 'Бронь отменена', body: `${seatsText(wholeCar, seats, true, true)} освободилось — рейс в ${time}` }
        : { title: 'Band bekor qilindi', body: `${seatsText(wholeCar, seats, false, true)} bo'shadi — ${time} dagi qatnov` },

  bookingCancelledByDispatcher:
    (reason: string): LocalizedPush =>
    (lang) =>
      lang === 'ru'
        ? { title: 'Ваша бронь отменена', body: `Диспетчер отменил вашу междугороднюю бронь: ${reason}` }
        : { title: 'Bandingiz bekor qilindi', body: `Dispetcher shaharlararo bandingizni bekor qildi: ${reason}` },

  boardingStarted: (): LocalizedPush => (lang) =>
    lang === 'ru'
      ? { title: 'Водитель выехал', body: 'Водитель едет за вами' }
      : { title: "Haydovchi yo'lga chiqdi", body: 'Haydovchi sizni olishga kelmoqda' },

  /** `reason` faqat haydovchi bekor qilganda; tizim sababi ichki kod — ko'rsatilmaydi. */
  tripCancelled:
    (byDriver: boolean, reason: string): LocalizedPush =>
    (lang) =>
      lang === 'ru'
        ? {
            title: 'Рейс отменён',
            body: byDriver
              ? `Водитель отменил рейс: ${reason}. Выберите другой рейс.`
              : 'Водитель не начал рейс — ваша бронь отменена. Выберите другой рейс.',
          }
        : {
            title: 'Qatnov bekor qilindi',
            body: byDriver
              ? `Haydovchi qatnovni bekor qildi: ${reason}. Boshqa qatnov tanlang.`
              : 'Haydovchi qatnovni boshlamadi — bandingiz bekor qilindi. Boshqa qatnov tanlang.',
          },

  driverReminder:
    (time: string, passengers: number): LocalizedPush =>
    (lang) =>
      lang === 'ru'
        ? { title: 'До вашего рейса 1 час', body: `Отправление в ${time} · пассажиров: ${passengers}` }
        : { title: 'Qatnovingizga 1 soat qoldi', body: `${time} da jo'nash · ${passengers} ta yo'lovchi` },

  passengerReminder:
    (time: string): LocalizedPush =>
    (lang) =>
      lang === 'ru'
        ? { title: 'До рейса 1 час', body: `Отправление в ${time}. Будьте готовы в точке посадки.` }
        : { title: 'Qatnovga 1 soat qoldi', body: `${time} da jo'nash. Olish manzilida tayyor turing.` },

  requestCreated:
    (route: string, window: string, wholeCar: boolean, seats: number, total: number): LocalizedPush =>
    (lang) => {
      const sum = total.toLocaleString('uz-UZ');
      return lang === 'ru'
        ? { title: `Новая заявка: ${route}`, body: `${window} · ${seatsText(wholeCar, seats, true)} · ${sum} сум` }
        : { title: `Yangi so'rov: ${route}`, body: `${window} · ${seatsText(wholeCar, seats, false)} · ${sum} so'm` };
    },

  requestAccepted:
    (time: string): LocalizedPush =>
    (lang) =>
      lang === 'ru'
        ? { title: 'Водитель найден', body: `Ваша заявка принята — отправление в ${time}` }
        : { title: 'Haydovchi topildi', body: `So'rovingiz qabul qilindi — jo'nash ${time} da` },

  requestExpired: (): LocalizedPush => (lang) =>
    lang === 'ru'
      ? { title: 'Водитель не найден', body: 'Время вашей заявки истекло. Выберите другое время и оставьте заявку снова.' }
      : {
          title: 'Haydovchi topilmadi',
          body: "So'rovingiz vaqti tugadi. Boshqa vaqtni tanlab yana so'rov qoldiring.",
        },
};
