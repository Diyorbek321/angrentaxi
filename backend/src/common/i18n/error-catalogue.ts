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

  // ─── Boshqa ──────────────────────────────────────────────────────────
  { source: 'Favorite address not found', uz: 'Saqlangan manzil topilmadi', ru: 'Сохранённый адрес не найден' },
  { source: 'You do not have access to this favorite address', uz: "Bu manzilga ruxsatingiz yo'q", ru: 'У вас нет доступа к этому адресу' },
  { source: 'You cannot access this support thread', uz: "Bu murojaatga ruxsatingiz yo'q", ru: 'У вас нет доступа к этому обращению' },
  { source: 'No route found', uz: 'Marshrut topilmadi', ru: 'Маршрут не найден' },
  { source: 'A user with this phone number already exists', uz: "Bu raqam bilan foydalanuvchi allaqachon bor", ru: 'Пользователь с этим номером уже существует' },
  { source: 'Shahar topilmadi: {0}', ru: 'Город не найден: {0}' },
];
