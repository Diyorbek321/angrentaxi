/**
 * Maxfiylik siyosati va hisobni o'chirish sahifalari matni (Google Play
 * talabi: ommaviy URL). ⚠️ QORALAMA — yurist ko'rib chiqishi kerak
 * (ayniqsa "Ma'lumotlar qayerda saqlanadi" bo'limi: "Shaxsga doir
 * ma'lumotlar to'g'risida"gi qonun 27-1-moddasi — lokalizatsiya).
 *
 * Matn faqat kodda haqiqatan yig'iladigan ma'lumotni sanaydi; yangi ma'lumot
 * turi qo'shilsa, shu yerga ham qo'shing (Play Data Safety formasi bilan bir xil bo'lsin).
 */
export type LegalLang = 'uz' | 'ru';

export interface LegalContext {
  operator: string;
  supportPhone: string;
  updated: string;
  deletionUrl: string;
  privacyUrl: string;
}

interface Section {
  h: string;
  p?: string[];
  li?: string[];
}

export interface LegalPage {
  title: string;
  intro: string;
  sections: Section[];
}

export function privacyPolicy(lang: LegalLang, c: LegalContext): LegalPage {
  return lang === 'ru' ? privacyRu(c) : privacyUz(c);
}

export function accountDeletionPage(lang: LegalLang, c: LegalContext): LegalPage {
  return lang === 'ru' ? deletionRu(c) : deletionUz(c);
}

function privacyUz(c: LegalContext): LegalPage {
  return {
    title: 'Maxfiylik siyosati',
    intro: `${c.operator} ("biz") Angren Taxi va Angren Taxi Driver ilovalari orqali qanday ma'lumot yig'ishi, nima uchun ishlatishi va qanday himoya qilishi. Yangilangan: ${c.updated}.`,
    sections: [
      {
        h: "Qanday ma'lumot yig'amiz",
        li: [
          "Telefon raqami — kirish (SMS kod) va siz bilan bog'lanish uchun.",
          "Ism va familiya — agar o'zingiz kiritsangiz.",
          "Joylashuv — buyurtma berish, haydovchini topish va safarni kuzatish uchun. Yo'lovchi ilovasi joylashuvni faqat ilova ochiq paytda oladi. Haydovchi ilovasi esa haydovchi \"onlayn\" bo'lgan vaqt davomida, ilova yopiq bo'lsa ham, doimiy bildirishnoma bilan oladi.",
          "Buyurtmalar tarixi: manzillar, narx, vaqt, baholar, bekor qilishlar, qo'llab-quvvatlash xabarlari.",
          "To'lovlar: summa, to'lov usuli va to'lov tizimi tranzaksiya raqami. Karta ma'lumotlarini biz ko'rmaymiz va saqlamaymiz — ular Payme/Click/Uzcard sahifasida kiritiladi.",
          "Push-bildirishnoma tokeni va ilova tili.",
          "Faqat haydovchilar: pasport va haydovchilik guvohnomasi ma'lumotlari va suratlari, avtomobil hujjatlari, JShShIR (PINFL), STIR, soliq maqomi, tug'ilgan sana, hamyon va daromad yozuvlari — bular qonun (VMQ 200, soliq qonunchiligi) talab qilgani uchun.",
          "Anonim foydalanish hisoblagichlari (masalan, nechta odam buyurtma ekranini ochdi) — shaxsga bog'lanmaydi.",
        ],
      },
      {
        h: 'Nima uchun ishlatamiz',
        li: [
          "Taksi, yetkazib berish va boshqa xizmatlarni ko'rsatish.",
          "Xavfsizlik: firibgarlikni aniqlash, SOS, nizolarni hal qilish.",
          "Qonun talablari: haydovchi hujjatlarini tekshirish, soliq hisobotlari, fiskal cheklar.",
          "Xizmat haqida bildirishnomalar (buyurtma holati, to'lov).",
        ],
        p: ["Ma'lumotlaringizni sotmaymiz va reklama uchun uchinchi tomonga bermaymiz."],
      },
      {
        h: "Kimga beriladi",
        li: [
          "Safar ishtirokchisiga: haydovchi yo'lovchining ismi va manzilini, yo'lovchi haydovchining ismi, avtomobili va joylashuvini ko'radi.",
          "Xizmat ko'rsatuvchilarga — faqat ularning vazifasi uchun: SMS jo'natish (Eskiz), push-bildirishnomalar (Google Firebase), to'lovlar (Payme, Click, Uzcard), fayllarni saqlash (Cloudflare), server (Oracle Cloud).",
          "Davlat organlariga — faqat qonunda belgilangan hollarda.",
        ],
      },
      {
        h: "Qayerda va qancha saqlanadi",
        p: [
          "Ma'lumotlar xizmat ko'rsatuvchilarning serverlarida shifrlangan aloqa (HTTPS) orqali uzatiladi va saqlanadi.",
          "Hisob faol bo'lgan davrda saqlanadi. Hisob o'chirilgach, shaxsni aniqlaydigan ma'lumotlar (telefon, ism, push-token) o'chiriladi. Safar, to'lov va soliq yozuvlari hamda haydovchi hujjatlari qonunda belgilangan muddat davomida shaxssizlantirilgan holda saqlanadi.",
        ],
      },
      {
        h: 'Huquqlaringiz',
        li: [
          "Ma'lumotlaringizni ko'rish va ilovada o'zgartirish.",
          `Hisobni o'chirish — ilovada (Profil → Hisobni o'chirish) yoki ${c.deletionUrl} sahifasidagi yo'riqnoma bo'yicha.`,
          "Joylashuv va bildirishnoma ruxsatlarini telefon sozlamalaridan istalgan vaqtda o'chirish.",
        ],
      },
      { h: 'Bolalar', p: ["Ilovalar 18 yoshdan kichiklar uchun mo'ljallanmagan."] },
      { h: "Bog'lanish", p: [`Savollar bo'yicha: ${c.operator}, telefon ${c.supportPhone}.`] },
    ],
  };
}

function privacyRu(c: LegalContext): LegalPage {
  return {
    title: 'Политика конфиденциальности',
    intro: `Как ${c.operator} («мы») собирает, использует и защищает данные в приложениях Angren Taxi и Angren Taxi Driver. Обновлено: ${c.updated}.`,
    sections: [
      {
        h: 'Какие данные мы собираем',
        li: [
          'Номер телефона — для входа (SMS-код) и связи с вами.',
          'Имя и фамилия — если вы их укажете.',
          'Геолокация — для оформления заказа, поиска водителя и отслеживания поездки. Приложение пассажира получает геолокацию только когда оно открыто. Приложение водителя — всё время, пока водитель «на линии», в том числе когда приложение свёрнуто, с постоянным уведомлением.',
          'История заказов: адреса, стоимость, время, оценки, отмены, обращения в поддержку.',
          'Платежи: сумма, способ оплаты и номер транзакции платёжной системы. Данные карты мы не видим и не храним — они вводятся на странице Payme/Click/Uzcard.',
          'Токен push-уведомлений и язык приложения.',
          'Только для водителей: данные и фото паспорта и водительского удостоверения, документы на автомобиль, ПИНФЛ, ИНН, налоговый статус, дата рождения, записи кошелька и заработка — по требованию закона (ПКМ № 200, налоговое законодательство).',
          'Анонимные счётчики использования (например, сколько человек открыли экран заказа) — не связаны с личностью.',
        ],
      },
      {
        h: 'Для чего используем',
        li: [
          'Оказание услуг такси, доставки и других сервисов.',
          'Безопасность: выявление мошенничества, SOS, разрешение споров.',
          'Требования закона: проверка документов водителей, налоговая отчётность, фискальные чеки.',
          'Сервисные уведомления (статус заказа, оплата).',
        ],
        p: ['Мы не продаём ваши данные и не передаём их третьим лицам для рекламы.'],
      },
      {
        h: 'Кому передаются',
        li: [
          'Участнику поездки: водитель видит имя и адрес пассажира, пассажир — имя, автомобиль и местоположение водителя.',
          'Поставщикам услуг — только для их задачи: отправка SMS (Eskiz), push-уведомления (Google Firebase), платежи (Payme, Click, Uzcard), хранение файлов (Cloudflare), сервер (Oracle Cloud).',
          'Государственным органам — только в случаях, предусмотренных законом.',
        ],
      },
      {
        h: 'Где и сколько хранятся',
        p: [
          'Данные передаются по зашифрованному соединению (HTTPS) и хранятся на серверах поставщиков услуг.',
          'Данные хранятся, пока аккаунт активен. После удаления аккаунта удаляются данные, позволяющие установить личность (телефон, имя, push-токен). Записи о поездках, платежах и налогах, а также документы водителей хранятся в обезличенном виде в течение срока, установленного законом.',
        ],
      },
      {
        h: 'Ваши права',
        li: [
          'Просматривать и изменять свои данные в приложении.',
          `Удалить аккаунт — в приложении (Профиль → Удалить аккаунт) или по инструкции на странице ${c.deletionUrl}.`,
          'В любой момент отключить доступ к геолокации и уведомлениям в настройках телефона.',
        ],
      },
      { h: 'Дети', p: ['Приложения не предназначены для лиц младше 18 лет.'] },
      { h: 'Контакты', p: [`По вопросам: ${c.operator}, телефон ${c.supportPhone}.`] },
    ],
  };
}

function deletionUz(c: LegalContext): LegalPage {
  return {
    title: "Angren Taxi hisobini o'chirish",
    intro: "Angren Taxi yoki Angren Taxi Driver hisobingizni va unga bog'langan shaxsiy ma'lumotlarni o'chirish tartibi.",
    sections: [
      {
        h: "Ilovada (eng tez yo'l)",
        li: [
          'Ilovani oching va hisobingizga kiring.',
          "Profil → \"Hisobni o'chirish\" ni bosing.",
          "Tasdiqlang. Hisob darhol o'chiriladi va barcha qurilmalarda tizimdan chiqasiz.",
        ],
      },
      {
        h: "Ilovaga kira olmasangiz",
        p: [
          `Qo'llab-quvvatlash xizmatiga ${c.supportPhone} raqami orqali hisobingiz ochilgan telefon raqamidan murojaat qiling. Raqam egasi ekaningiz tasdiqlangach, hisob 7 kun ichida o'chiriladi.`,
        ],
      },
      {
        h: "Nima o'chiriladi",
        li: ["Telefon raqami, ism va familiya, push-bildirishnoma tokeni.", "Hisobga kirish (barcha sessiyalar bekor qilinadi)."],
      },
      {
        h: 'Nima saqlanib qoladi va qancha',
        p: [
          "Safar, to'lov va soliq yozuvlari hamda haydovchi hujjatlari qonunda belgilangan muddat davomida shaxssizlantirilgan holda saqlanadi.",
          `Batafsil: ${c.privacyUrl}`,
        ],
      },
      {
        h: "O'chirishdan oldin",
        p: [
          "Faol buyurtma bo'lsa, uni yakunlang yoki bekor qiling. Haydovchilar: hamyondagi pulni yechib oling yoki qarzni yoping — aks holda ilova sababini ko'rsatadi.",
        ],
      },
    ],
  };
}

function deletionRu(c: LegalContext): LegalPage {
  return {
    title: 'Удаление аккаунта Angren Taxi',
    intro: 'Как удалить аккаунт Angren Taxi или Angren Taxi Driver и связанные с ним персональные данные.',
    sections: [
      {
        h: 'В приложении (самый быстрый способ)',
        li: [
          'Откройте приложение и войдите в аккаунт.',
          'Нажмите Профиль → «Удалить аккаунт».',
          'Подтвердите. Аккаунт удаляется сразу, вы выходите из системы на всех устройствах.',
        ],
      },
      {
        h: 'Если нет доступа к приложению',
        p: [
          `Обратитесь в поддержку по номеру ${c.supportPhone} с номера телефона, на который открыт аккаунт. После подтверждения владения номером аккаунт будет удалён в течение 7 дней.`,
        ],
      },
      {
        h: 'Что удаляется',
        li: ['Номер телефона, имя и фамилия, токен push-уведомлений.', 'Доступ к аккаунту (все сессии завершаются).'],
      },
      {
        h: 'Что сохраняется и как долго',
        p: [
          'Записи о поездках, платежах и налогах, а также документы водителей хранятся в обезличенном виде в течение срока, установленного законом.',
          `Подробнее: ${c.privacyUrl}`,
        ],
      },
      {
        h: 'Перед удалением',
        p: [
          'Если есть активный заказ — завершите или отмените его. Водителям: выведите деньги из кошелька или погасите долг — иначе приложение покажет причину.',
        ],
      },
    ],
  };
}
