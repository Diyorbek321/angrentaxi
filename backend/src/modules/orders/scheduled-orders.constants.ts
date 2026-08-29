// Rejalashtirilgan safarning vaqt chegaralari. Bitta joyda turadi, chunki
// ularning uchtasi ham ikki tomondan o'qiladi: yaratishdagi validatsiya
// (`OrdersCreationService`) va cron (`ScheduledOrdersService`). Ikki nusxada
// yozilsa, ular ohista bir-biridan uzoqlashadi va "rejalashtirdim, lekin
// hech qachon bajarilmadi" turidagi jim xatolar paydo bo'ladi.

/**
 * Buyurtma hozirdan kamida shuncha daqiqa keyinga rejalashtirilishi kerak.
 *
 * NEGA nol emas: dispatch qidiruvni `SCHEDULED_DISPATCH_LEAD_MINUTES` oldin
 * boshlaydi, ya'ni undan yaqinroq vaqtga rejalashtirilgan safar amalda
 * "hozirgi" buyurtma bo'lardi — faqat ortiqcha bir bosqich bilan. Bunday
 * holatda yo'lovchi oddiy buyurtma bersa to'g'riroq bo'ladi.
 */
export const SCHEDULED_MIN_LEAD_MINUTES = 30;

/** Bundan uzoqqa reja qabul qilinmaydi (tarif ham, shahar ham o'zgaradi). */
export const SCHEDULED_MAX_AHEAD_DAYS = 14;

/**
 * Qidiruv olib ketish vaqtidan shuncha daqiqa OLDIN boshlanadi.
 *
 * Haydovchini topish + uning yo'lovchi oldiga yetib borishi uchun zaxira.
 */
export const SCHEDULED_DISPATCH_LEAD_MINUTES = 10;

/**
 * `scheduled_at` dan shuncha daqiqa o'tib ketgan buyurtma bekor qilinadi.
 *
 * Backend bir necha soat o'chib turgan holat uchun himoya: usiz o'tgan
 * haftadagi rejalashtirilgan safar bugun to'satdan haydovchi qidira
 * boshlardi va yo'lovchi kutmagan safar buyurtma qilingan bo'lardi.
 */
export const SCHEDULED_STALE_AFTER_MINUTES = 30;

/** Bitta cron tick'ida ko'pi bilan shuncha buyurtma ishlanadi. */
export const SCHEDULED_DISPATCH_BATCH = 50;

/**
 * `GET /orders/scheduled` bir marta qaytaradigan maksimal reja soni.
 *
 * Sahifalash emas, qochib ketishdan himoya: yo'lovchida realistik holda
 * bir nechta reja bo'ladi, yuzlab emas.
 */
export const SCHEDULED_LIST_LIMIT = 50;

export const MS_PER_MINUTE = 60_000;
