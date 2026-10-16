/**
 * Server xato xabarlarining tarjima lug'ati (biznes qarori, 2026-10-09:
 * ilova tiliga qarab UZ yoki RU).
 *
 * NEGA LUG'AT, KALIT EMAS: 260+ `throw` joyini bittalab kalitga o'tkazish
 * katta va xavfli o'zgarish bo'lardi. Buning o'rniga xabar matnining o'zi
 * kalit: `HttpExceptionFilter` javob berishdan oldin uni shu yerdan qidiradi.
 * Lug'atda yo'q xabar O'ZGARMAY qaytadi — ya'ni yangi xabar qo'shilsa hech
 * narsa buzilmaydi, faqat tarjima qilinmay qoladi.
 *
 * `source` — kodda turgan matn; `${...}` o'rnida `{0}`, `{1}`... Tarjimada
 * shu belgilar qiymat bilan almashtiriladi.
 * `uz` yo'q — manba allaqachon o'zbekcha.
 *
 * ⚠️ Matn kodda o'zgarsa, `error-messages.spec.ts` yiqiladi — lug'atni ham
 * yangilang.
 */
import { LEGAL_DOCUMENT_TEXTS } from '../../modules/drivers/legal-document-texts';

export interface ErrorCatalogueEntry {
  source: string;
  uz?: string;
  ru: string;
}

export const ERROR_CATALOGUE: readonly ErrorCatalogueEntry[] = [
  // ─── Kirish va huquq ─────────────────────────────────────────────────
  { source: 'Invalid OTP code', uz: "SMS kod noto'g'ri", ru: 'Неверный код из SMS' },
  { source: 'OTP code has expired', uz: "SMS kodning muddati o'tgan — yangisini so'rang", ru: 'Срок действия кода истёк — запросите новый' },
  {
    source: 'Too many invalid attempts. This code has been cancelled — request a new one.',
    uz: "Juda ko'p noto'g'ri urinish. Kod bekor qilindi — yangisini so'rang.",
    ru: 'Слишком много неверных попыток. Код отменён — запросите новый.',
  },
  { source: 'Invalid or expired refresh token', uz: 'Sessiya tugagan — qaytadan kiring', ru: 'Сессия истекла — войдите снова' },
  { source: 'Account is blocked', uz: 'Hisobingiz bloklangan', ru: 'Ваш аккаунт заблокирован' },
  { source: 'Authentication required', uz: 'Avval tizimga kiring', ru: 'Сначала войдите в систему' },
  { source: 'User not found', uz: 'Foydalanuvchi topilmadi', ru: 'Пользователь не найден' },
  { source: 'Invalid token type', uz: 'Sessiya yaroqsiz — qaytadan kiring', ru: 'Сессия недействительна — войдите снова' },
  {
    source: "Xizmat vaqtincha texnik ishlar tufayli to'xtatilgan. Iltimos, keyinroq urinib ko'ring.",
    ru: 'Сервис временно приостановлен из-за технических работ. Пожалуйста, попробуйте позже.',
  },

  // ─── Buyurtma berish ─────────────────────────────────────────────────
  { source: "Bu hududda hozircha xizmat ko'rsatilmaymiz", ru: 'В этом районе мы пока не работаем' },
  { source: "Rejalashtirilgan vaqt formati noto'g'ri", ru: 'Неверный формат запланированного времени' },
  {
    source: "Rejalashtirilgan safar hozirdan kamida {0} daqiqa keyin bo'lishi kerak",
    ru: 'Запланированная поездка должна быть не раньше чем через {0} мин',
  },
  {
    source: "Safarni ko'pi bilan {0} kun oldin rejalashtirish mumkin",
    ru: 'Поездку можно запланировать не более чем за {0} дн.',
  },
  {
    source: 'Manzilning ikkala koordinatasi ham kerak (yoki hech biri — taksometr)',
    ru: 'Нужны обе координаты адреса (или ни одной — таксометр)',
  },
  { source: 'Manzilsiz (taksometr) buyurtma faqat taksi uchun', ru: 'Заказ без адреса (таксометр) — только для такси' },
  { source: "Oraliq bekat bilan manzil ham ko'rsatilishi kerak", ru: 'С промежуточной остановкой нужно указать и адрес назначения' },
  { source: 'Selected tariff is not available', uz: 'Tanlangan tarif hozir mavjud emas', ru: 'Выбранный тариф сейчас недоступен' },
  { source: "Posilka faqat 'Posilka' tarifi bilan beriladi", ru: 'Посылку можно отправить только по тарифу «Посылка»' },
  { source: 'Bu tarif faqat posilka uchun', ru: 'Этот тариф только для посылок' },
  {
    source: "You have an unpaid balance of {0} so'm from a previous trip. Please top up your wallet before ordering again.",
    uz: "Oldingi safardan {0} so'm to'lanmagan qarzingiz bor. Yangi buyurtmadan oldin hamyonni to'ldiring.",
    ru: 'У вас неоплаченный долг {0} сум за прошлую поездку. Пополните кошелёк перед новым заказом.',
  },
  { source: "Posilka ma'lumoti noto'g'ri: {0}", ru: 'Неверные данные посылки: {0}' },
  {
    source: "Naqd to'lov {0} so'mgacha. Bu buyurtmani karta bilan to'lang.",
    ru: 'Наличными — до {0} сум. Оплатите этот заказ картой.',
  },

  // ─── Buyurtma holati ─────────────────────────────────────────────────
  { source: 'Order not found', uz: 'Buyurtma topilmadi', ru: 'Заказ не найден' },
  { source: 'Order {0} not found', uz: 'Buyurtma topilmadi', ru: 'Заказ не найден' },
  { source: 'Buyurtma topilmadi', ru: 'Заказ не найден' },
  { source: 'You are not authorized to view this order', uz: "Bu buyurtmani ko'rishga ruxsatingiz yo'q", ru: 'У вас нет доступа к этому заказу' },
  { source: 'You are not authorized to cancel this order', uz: 'Bu buyurtmani bekor qila olmaysiz', ru: 'Вы не можете отменить этот заказ' },
  { source: 'Cannot cancel order with status {0}', uz: "Buyurtmani hozirgi holatida bekor qilib bo'lmaydi", ru: 'Заказ в текущем статусе отменить нельзя' },
  {
    source: 'Order is no longer in the expected state',
    uz: "Buyurtma holati o'zgargan — sahifani yangilang",
    ru: 'Статус заказа изменился — обновите страницу',
  },
  { source: 'Driver already has an active order', uz: 'Sizda allaqachon faol buyurtma bor', ru: 'У вас уже есть активный заказ' },
  { source: 'Order already has a driver', uz: 'Buyurtmani boshqa haydovchi oldi', ru: 'Заказ уже взял другой водитель' },
  { source: 'Cannot accept order with status {0}', uz: "Bu buyurtmani endi qabul qilib bo'lmaydi", ru: 'Этот заказ уже нельзя принять' },
  { source: 'Cannot mark arrived for order with status {0}', uz: "Hozir \"Yetib keldim\" deb belgilab bo'lmaydi", ru: 'Сейчас нельзя отметить «Я на месте»' },
  {
    source: 'You must be within 500m of the pickup location (currently {0}m away)',
    uz: "Olish nuqtasiga 500 m dan yaqin bo'lishingiz kerak (hozir {0} m uzoqda)",
    ru: 'Нужно быть в пределах 500 м от точки подачи (сейчас {0} м)',
  },
  { source: 'Cannot start trip for order with status {0}', uz: "Safarni hozir boshlab bo'lmaydi", ru: 'Сейчас нельзя начать поездку' },
  { source: 'Cannot complete order with status {0}', uz: "Safarni hozir yakunlab bo'lmaydi", ru: 'Сейчас нельзя завершить поездку' },
  { source: 'You are not the driver for this order', uz: 'Bu buyurtma sizga biriktirilmagan', ru: 'Этот заказ не назначен вам' },
  { source: 'Order has no driver to complete it for', uz: 'Buyurtmaga haydovchi biriktirilmagan', ru: 'К заказу не назначен водитель' },
  { source: 'Chek faqat tugagan safar uchun mavjud', ru: 'Чек доступен только для завершённой поездки' },
  { source: 'Bu buyurtma taksometrli emas', ru: 'Этот заказ не по таксометру' },
  { source: 'Taksometr faqat safar davomida ishlaydi', ru: 'Таксометр работает только во время поездки' },
  {
    source: "Posilkani topshirish uchun qabul qiluvchidan 4 xonali PIN kodni so'rang.",
    ru: 'Чтобы передать посылку, спросите у получателя 4-значный PIN-код.',
  },
  {
    source: "PIN urinishlari tugadi. Dispetcherga qo'ng'iroq qiling — u qabul qiluvchi bilan gaplashib, safarni yakunlaydi.",
    ru: 'Попытки ввода PIN закончились. Позвоните диспетчеру — он свяжется с получателем и завершит поездку.',
  },
  { source: "PIN noto'g'ri. Qolgan urinishlar: {0}.", ru: 'Неверный PIN. Осталось попыток: {0}.' },

  // ─── Chaqim, baho, topilgan buyum ────────────────────────────────────
  { source: 'Bu safar sizga tegishli emas', ru: 'Эта поездка не ваша' },
  { source: 'Chaqim faqat tugagan safar uchun beriladi', ru: 'Чаевые можно оставить только после завершения поездки' },
  { source: 'Bu buyurtmaga haydovchi biriktirilmagan', ru: 'К этому заказу не назначен водитель' },
  { source: 'Bu safar uchun chaqim allaqachon berilgan', ru: 'Чаевые за эту поездку уже оставлены' },
  { source: "Hamyonda mablag' yetarli emas. Avval hamyonni to'ldiring.", ru: 'На кошельке недостаточно средств. Сначала пополните кошелёк.' },
  { source: "Safar tugagan vaqt aniqlanmadi — chaqim berib bo'lmaydi", ru: 'Не удалось определить время окончания поездки — чаевые оставить нельзя' },
  { source: 'Chaqim safar tugaganidan keyin 24 soat ichida beriladi', ru: 'Чаевые можно оставить в течение 24 часов после поездки' },
  { source: 'Rating can only be submitted for completed orders', uz: 'Faqat tugagan safarga baho qo\'yiladi', ru: 'Оценить можно только завершённую поездку' },
  { source: 'You have already rated this order', uz: "Bu safarga allaqachon baho qo'ygansiz", ru: 'Вы уже оценили эту поездку' },
  { source: 'You are not the passenger of this order', uz: "Siz bu safarning yo'lovchisi emassiz", ru: 'Вы не пассажир этой поездки' },
  { source: 'You are not the driver of this order', uz: 'Siz bu safarning haydovchisi emassiz', ru: 'Вы не водитель этой поездки' },
  { source: 'This order has no assigned driver', uz: 'Bu buyurtmaga haydovchi biriktirilmagan', ru: 'К этому заказу не назначен водитель' },
  { source: 'Faqat yakunlangan safar uchun xabar berish mumkin', ru: 'Сообщить можно только о завершённой поездке' },
  {
    source: "Safardan {0} kundan ko'p vaqt o'tgan — qo'llab-quvvatlash xizmatiga yozing",
    ru: 'С поездки прошло больше {0} дн. — напишите в поддержку',
  },
  { source: 'Bu safar bo‘yicha xabar allaqachon yuborilgan', ru: 'Сообщение по этой поездке уже отправлено' },
  { source: 'Siz bu xabarga allaqachon javob bergansiz', ru: 'Вы уже ответили на это сообщение' },
  { source: 'Bu xabar allaqachon yopilgan', ru: 'Это сообщение уже закрыто' },
  { source: 'You are not a party to this order', uz: 'Siz bu buyurtma ishtirokchisi emassiz', ru: 'Вы не участник этого заказа' },
  { source: 'You are not a participant of this trip', uz: 'Siz bu safar ishtirokchisi emassiz', ru: 'Вы не участник этой поездки' },

  // ─── To'lov va promokod ──────────────────────────────────────────────
  { source: 'Order does not belong to you', uz: 'Bu buyurtma sizniki emas', ru: 'Этот заказ не ваш' },
  { source: 'Order must be completed before payment', uz: "To'lov safar tugagandan keyin", ru: 'Оплата — после завершения поездки' },
  { source: 'Cannot pay for a cancelled order', uz: "Bekor qilingan buyurtma uchun to'lab bo'lmaydi", ru: 'Нельзя оплатить отменённый заказ' },
  {
    source: 'Requested amount ({0}) exceeds available wallet balance ({1})',
    uz: "So'ralgan summa ({0}) hamyondagi mablag'dan ({1}) ko'p",
    ru: 'Запрошенная сумма ({0}) больше баланса кошелька ({1})',
  },
  { source: 'Promo code not found', uz: 'Promokod topilmadi', ru: 'Промокод не найден' },
  { source: 'Promo code is no longer active', uz: 'Promokod endi amal qilmaydi', ru: 'Промокод больше не действует' },
  { source: 'Promo code has expired', uz: "Promokod muddati o'tgan", ru: 'Срок действия промокода истёк' },
  { source: 'Promo code usage limit has been reached', uz: 'Promokod limiti tugagan', ru: 'Лимит использования промокода исчерпан' },
  {
    source: 'Minimum order amount for this promo code is {0} UZS',
    uz: "Bu promokod uchun eng kam buyurtma summasi — {0} so'm",
    ru: 'Минимальная сумма заказа для этого промокода — {0} сум',
  },
  { source: 'You have already used this promo code', uz: 'Bu promokoddan allaqachon foydalangansiz', ru: 'Вы уже использовали этот промокод' },
  { source: 'A referral code has already been applied to this account', uz: "Taklif kodi allaqachon kiritilgan", ru: 'Реферальный код уже применён' },
  { source: 'Invalid referral code', uz: "Taklif kodi noto'g'ri", ru: 'Неверный реферальный код' },
  { source: 'You cannot use your own referral code', uz: "O'z taklif kodingizni ishlatib bo'lmaydi", ru: 'Нельзя использовать свой реферальный код' },

  // ─── Haydovchi ───────────────────────────────────────────────────────
  { source: 'Driver profile not found', uz: 'Haydovchi profili topilmadi', ru: 'Профиль водителя не найден' },
  { source: 'Driver not found', uz: 'Haydovchi topilmadi', ru: 'Водитель не найден' },
  { source: 'Driver profile already exists for this user', uz: 'Haydovchi profili allaqachon mavjud', ru: 'Профиль водителя уже существует' },
  { source: 'This account type cannot apply to become a driver', uz: "Bu hisob turi haydovchi bo'la olmaydi", ru: 'Этот тип аккаунта не может стать водителем' },
  {
    source: 'Your account is awaiting admin approval before you can go online',
    uz: 'Hisobingiz admin tasdig\'ini kutmoqda — tasdiqlangach onlayn bo\'lasiz',
    ru: 'Ваш аккаунт ожидает одобрения администратора — после этого можно выйти на линию',
  },
  {
    source: "Hisobingiz manfiy ({0} so'm). Onlayn bo'lish uchun qarzni yoping.",
    ru: 'Ваш баланс отрицательный ({0} сум). Погасите долг, чтобы выйти на линию.',
  },
  {
    source: 'Kamida bitta xizmat turi tanlanishi shart — aks holda sizga hech qanday buyurtma kelmaydi.',
    ru: 'Выберите хотя бы один вид услуг — иначе заказы не будут приходить.',
  },
  {
    source: "«{0}» xizmatini o'chirib bo'lmaydi: hozir shu turdagi faol buyurtmani bajaryapsiz. Avval buyurtmani yakunlang.",
    ru: 'Нельзя отключить услугу «{0}»: вы выполняете активный заказ этого типа. Сначала завершите заказ.',
  },
  { source: 'Sizda ko‘rib chiqilayotgan so‘rov bor — natijasini kuting', ru: 'У вас уже есть заявка на рассмотрении — дождитесь результата' },
  { source: 'Yangi ma’lumotlar hozirgisi bilan bir xil', ru: 'Новые данные совпадают с текущими' },
  { source: 'Bu so‘rov allaqachon ko‘rib chiqilgan', ru: 'Эта заявка уже рассмотрена' },
  { source: 'File content is not a JPEG, PNG, WEBP or PDF', uz: 'Fayl JPEG, PNG, WEBP yoki PDF emas', ru: 'Файл не является JPEG, PNG, WEBP или PDF' },
  { source: 'Fayl yuborilmadi (multipart maydoni "file" kutilgan)', ru: 'Файл не отправлен' },
  { source: 'No file uploaded (expected multipart field "file")', uz: 'Fayl yuborilmadi', ru: 'Файл не отправлен' },
  { source: 'Bu yetkazish sizga biriktirilmagan', ru: 'Эта доставка не назначена вам' },
  { source: "Bu buyurtmada do'konga to'lanadigan naqd pul yo'q", ru: 'По этому заказу не нужно платить магазину наличными' },
  { source: "To'lovni tovar olinguncha belgilash mumkin", ru: 'Оплату можно отметить только до получения товара' },
  {
    source: "Avval do'konga {0} so'm to'lang va \"To'ladim\" ni bosing",
    ru: 'Сначала оплатите магазину {0} сум и нажмите «Оплатил»',
  },
  { source: 'Only drivers can update location', uz: 'Joylashuvni faqat haydovchi yuboradi', ru: 'Местоположение отправляет только водитель' },

  // ─── Ovqat va market (mijoz) ─────────────────────────────────────────
  { source: 'Restaurant not found', uz: 'Restoran topilmadi', ru: 'Ресторан не найден' },
  { source: 'Store not found', uz: "Do'kon topilmadi", ru: 'Магазин не найден' },
  { source: 'Product not found', uz: 'Mahsulot topilmadi', ru: 'Товар не найден' },
  { source: 'Dish {0} not found in this restaurant', uz: 'Taom bu restoranda topilmadi', ru: 'Блюдо не найдено в этом ресторане' },
  { source: 'Product {0} not found in this store', uz: "Mahsulot bu do'konda topilmadi", ru: 'Товар не найден в этом магазине' },
  { source: '"{0}" is not available', uz: '"{0}" hozir mavjud emas', ru: '«{0}» сейчас недоступно' },
  { source: 'Not enough stock for "{0}"', uz: '"{0}" yetarli emas', ru: 'Недостаточно товара «{0}»' },
  {
    source: 'No active delivery tariff configured for food orders',
    uz: 'Yetkazish hozircha ishlamayapti',
    ru: 'Доставка временно недоступна',
  },
  {
    source: 'No active delivery tariff configured for market orders',
    uz: 'Yetkazish hozircha ishlamayapti',
    ru: 'Доставка временно недоступна',
  },

  // ─── Huquqiy talablar (VMQ 200) — LEGAL_NOT_ELIGIBLE ────────────────
  {
    source: "Taksi uchun onlayn chiqa olmaysiz: {0}. Ilovadagi «Hujjatlar» bo'limida to'ldiring.",
    ru: 'Нельзя выйти на линию такси: {0}. Заполните раздел «Документы» в приложении.',
  },
  {
    source: "«Taksi» xizmatini yoqib bo'lmadi: {0}. Ilovadagi «Hujjatlar» bo'limida to'ldiring.",
    ru: 'Не удалось включить услугу «Такси»: {0}. Заполните раздел «Документы» в приложении.',
  },
  { source: "Tug'ilgan sana kiritilmagan", ru: 'Не указана дата рождения' },
  { source: "Haydovchi kamida {0} yoshda bo'lishi shart (VMQ 200)", ru: 'Водителю должно быть не менее {0} лет (ПКМ № 200)' },
  { source: 'Haydovchilik guvohnomasi berilgan sana kiritilmagan', ru: 'Не указана дата выдачи водительского удостоверения' },
  { source: "B toifali haydovchilik staji kamida {0} yil bo'lishi shart", ru: 'Стаж вождения категории B должен быть не менее {0} лет' },
  { source: 'Avtomobil ishlab chiqarilgan yili kiritilmagan', ru: 'Не указан год выпуска автомобиля' },
  {
    source: "Avtomobil {0} yildan eski — shahar ichida taksi sifatida ishlatib bo'lmaydi",
    ru: 'Автомобилю больше {0} лет — его нельзя использовать как такси в городе',
  },
  {
    source: "Soliq maqomi yo'q: o'zini o'zi band qilgan yoki YaTT sifatida ro'yxatdan o'ting",
    ru: 'Нет налогового статуса: зарегистрируйтесь как самозанятый или ИП',
  },
  { source: 'JShShIR (PINFL, 14 raqam) kiritilmagan', ru: 'Не указан ПИНФЛ (14 цифр)' },
  { source: 'YaTT uchun STIR (INN, 9 raqam) kiritilishi shart', ru: 'Для ИП обязательно указать ИНН (9 цифр)' },
  {
    source: "Taksi haydovchisi O'zbekiston Respublikasi fuqarosi bo'lishi shart",
    ru: 'Водитель такси должен быть гражданином Республики Узбекистан',
  },
  { source: 'Taksi litsenziya varaqasi raqami kiritilmagan', ru: 'Не указан номер лицензионной карточки такси' },
  { source: "«{0}» yuklanmagan, rad etilgan yoki muddati o'tgan", ru: '«{0}» не загружен, отклонён или просрочен' },
  // Hujjat nomlari — yuqoridagi sabab ichida `{0}` bo'lib keladi.
  ...Object.values(LEGAL_DOCUMENT_TEXTS).map((text) => ({ source: text.label, ru: text.ru.label })),

  // ─── Smena (SHIFT_PASS_*) ────────────────────────────────────────────
  { source: 'Smena hozircha mavjud emas', ru: 'Смена пока недоступна' },
  {
    source: 'Sizda faol smena bor — u tugagach yangisini oling',
    ru: 'У вас уже есть активная смена — новую можно купить после её окончания',
  },
  {
    source: "Hamyonda mablag' yetarli emas: smena narxi {0} so'm, balansingiz {1} so'm. Avval hamyonni to'ldiring.",
    ru: 'Недостаточно средств: смена стоит {0} сум, на балансе {1} сум. Сначала пополните кошелёк.',
  },

  // ─── Sotuvchiga hamyon orqali o'tkazma (WALLET_INSUFFICIENT_FOR_VENDOR) ─
  {
    source:
      "Hamyonda mablag' yetarli emas: do'konga {0} so'm o'tkazish kerak, balansingiz {1} so'm. Avval hamyonni to'ldiring.",
    ru: 'Недостаточно средств: нужно перевести заведению {0} сум, на балансе {1} сум. Сначала пополните кошелёк.',
  },

  // ─── Hamyonni to'ldirish (WALLET_TOPUP_*) ────────────────────────────
  {
    source: "Hamyonni karta orqali to'ldirish hozircha yoqilmagan. Dispetcherga murojaat qiling.",
    ru: 'Пополнение кошелька картой пока не включено. Обратитесь к диспетчеру.',
  },
  { source: "Summa {0} so'mdan {1} so'mgacha bo'lishi kerak", ru: 'Сумма должна быть от {0} до {1} сум' },
  { source: "Bu to'lov tizimi hali ulanmagan. Boshqasini tanlang.", ru: 'Эта платёжная система ещё не подключена. Выберите другую.' },
  {
    source: "To'lov tizimiga ulanib bo'lmadi. Birozdan keyin urinib ko'ring.",
    ru: 'Не удалось подключиться к платёжной системе. Попробуйте чуть позже.',
  },
  { source: "To'ldirish topilmadi", ru: 'Пополнение не найдено' },
  {
    source: "To'lanmagan to'ldirishlar juda ko'p ({0} ta). Avvalgisini yakunlang yoki muddati o'tishini kuting.",
    ru: 'Слишком много неоплаченных пополнений ({0}). Завершите предыдущее или дождитесь истечения его срока.',
  },

  // ─── Food/Market UX v5 (docs/specs/food-market-ux-v5.md) ─────────────
  {
    source: "Restoran buyurtmani qabul qildi — bekor qilish uchun qo'llab-quvvatlashga yozing",
    ru: 'Ресторан уже принял заказ — для отмены напишите в поддержку',
  },
  {
    source: "Do'kon buyurtmani qabul qildi — bekor qilish uchun qo'llab-quvvatlashga yozing",
    ru: 'Магазин уже принял заказ — для отмены напишите в поддержку',
  },
  { source: 'Bu promokod ushbu xizmatda amal qilmaydi', ru: 'Этот промокод не действует для этого сервиса' },
  { source: 'Aksiya topilmadi', ru: 'Акция не найдена' },
  { source: "Foizli chegirma 1 dan 90 gacha bo'lishi kerak", ru: 'Процентная скидка должна быть от 1 до 90' },
  { source: "Chegirma summasi 0 dan katta bo'lishi kerak", ru: 'Сумма скидки должна быть больше 0' },
  { source: 'Aksiya tugash vaqti boshlanishidan keyin bo‘lishi kerak', ru: 'Окончание акции должно быть позже её начала' },
  { source: 'Chegirma summasi taom narxidan kichik bo‘lishi kerak', ru: 'Сумма скидки должна быть меньше цены товара' },
  { source: 'Kamida bitta kategoriya tanlang', ru: 'Выберите хотя бы одну категорию' },
  { source: 'Kategoriya topilmadi', ru: 'Категория не найдена' },
  { source: 'Kamida bitta taom yoki mahsulot tanlang', ru: 'Выберите хотя бы одно блюдо или товар' },
  { source: 'Taom yoki mahsulot topilmadi', ru: 'Блюдо или товар не найдены' },

  // ─── Xavfsizlik (security review 2026-10-15) ──────────────────────────
  {
    source: "Karta orqali to'ldirilgan {0} so'm {1} kun davomida yechib olinmaydi. Hozir yechish mumkin: {2} so'm.",
    ru: 'Пополнение картой на {0} сум нельзя вывести в течение {1} дн. Сейчас доступно к выводу: {2} сум.',
  },
  {
    source:
      "Karta orqali to'ldirilgan {0} so'm {1} kun davomida va bonus {2} so'm yechib olinmaydi (bonus faqat komissiya, soliq va smenaga sarflanadi). Hozir yechish mumkin: {3} so'm.",
    ru: 'Пополнение картой на {0} сум (в течение {1} дн.) и бонус {2} сум нельзя вывести (бонус расходуется только на комиссию, налог и смену). Сейчас доступно к выводу: {3} сум.',
  },
  {
    source:
      "Bonus {0} so'm yechib olinmaydi — u faqat komissiya, soliq va smenaga sarflanadi. Hozir yechish mumkin: {1} so'm.",
    ru: 'Бонус {0} сум нельзя вывести — он расходуется только на комиссию, налог и смену. Сейчас доступно к выводу: {1} сум.',
  },
  {
    source:
      "Hujjatingiz tasdiqlangan: JShShIR, STIR, soliq maqomi va tug'ilgan sanani endi faqat dispetcher o'zgartira oladi. Qo'llab-quvvatlash xizmatiga murojaat qiling.",
    ru: 'Ваш документ подтверждён: ПИНФЛ, ИНН, налоговый статус и дату рождения теперь может изменить только диспетчер. Обратитесь в службу поддержки.',
  },
  { source: "Bu JShShIR boshqa haydovchi profilida ro'yxatdan o'tgan", ru: 'Этот ПИНФЛ уже зарегистрирован у другого водителя' },
  { source: "Bu STIR boshqa haydovchi profilida ro'yxatdan o'tgan", ru: 'Этот ИНН уже зарегистрирован у другого водителя' },
  {
    source: "Menejer bir martada ko'pi bilan {0} so'm tuzatishi mumkin. Kattaroq summa uchun adminga murojaat qiling.",
    ru: 'Менеджер может скорректировать не более {0} сум за раз. Для большей суммы обратитесь к администратору.',
  },
  { source: "Summa butun son va {0} so'mdan oshmasligi kerak", ru: 'Сумма должна быть целым числом и не больше {0} сум' },
  { source: "Summa butun so'mda bo'lishi kerak", ru: 'Сумма должна быть в целых сумах' },

  // ─── Boshqa ──────────────────────────────────────────────────────────
  { source: 'Favorite address not found', uz: 'Saqlangan manzil topilmadi', ru: 'Сохранённый адрес не найден' },
  { source: 'You do not have access to this favorite address', uz: "Bu manzilga ruxsatingiz yo'q", ru: 'У вас нет доступа к этому адресу' },
  { source: 'You cannot access this support thread', uz: "Bu murojaatga ruxsatingiz yo'q", ru: 'У вас нет доступа к этому обращению' },
  { source: 'No route found', uz: 'Marshrut topilmadi', ru: 'Маршрут не найден' },
  { source: 'A user with this phone number already exists', uz: "Bu raqam bilan foydalanuvchi allaqachon bor", ru: 'Пользователь с этим номером уже существует' },
  { source: 'Shahar topilmadi: {0}', ru: 'Город не найден: {0}' },
];
