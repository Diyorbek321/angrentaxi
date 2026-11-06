/**
 * Haydovchiga (yoki sotuvchiga) pul CHIQARISH chegarasi.
 *
 * ⚠️ NEGA `IPaymentProvider` dan ALOHIDA. U pulni ichkariga oladi
 * (yo'lovchi → platforma), bu esa tashqariga chiqaradi (platforma →
 * haydovchi). Provayderlar tomonida ular butunlay boshqa API, boshqa
 * shartnoma va boshqa xavf profili: kirim xatosi — buyurtma amalga
 * oshmaydi, chiqim xatosi — pul noto'g'ri odamga ketadi. Bitta interfeysga
 * tiqish ikkalasini ham noto'g'ri modellashtirardi.
 *
 * Hozir yagona amalga oshirish — `ManualPayoutProvider`: pulni operator
 * o'z banki orqali o'tkazadi. Payme/Click payout kalitlari kelganda faqat
 * shu interfeysning yangi amalga oshirilishi yoziladi va
 * `PAYOUT_PROVIDER` boshqa sinfga bog'lanadi; `PaymentsService` ga
 * tegilmaydi.
 */

/** Chiqarish urinishining natijasi. */
export interface PayoutResult {
  /**
   * Provayder tomonidagi o'tkazma identifikatori — keyinchalik nizoni
   * hal qilish uchun yagona ilinadigan ip.
   *
   * Qo'lda o'tkazmada `null`: hech qanday tizim raqam bermagan va soxta
   * qiymat o'ylab topish (masalan `manual-<id>`) uni haqiqiy provayder
   * raqamidan ajratib bo'lmaydigan qilardi.
   */
  reference: string | null;

  /**
   * Pul HAQIQATAN jo'natildimi.
   *
   * ⚠️ Qo'lda oqimda bu `true`, chunki operator "to'landi" tugmasini pulni
   * o'tkazgandan KEYIN bosadi — ya'ni tasdiq odamdan keladi. Avtomatik
   * provayderda esa `false` bo'lishi mumkin: o'tkazma navbatga tushgan,
   * lekin hali tasdiqlanmagan. Shu sabab maydon mavjud — aks holda
   * kelajakdagi provayder "yuborildi" ni "yetdi" bilan tenglashtirishga
   * majbur bo'lardi.
   */
  settled: boolean;
}

export interface IPayoutProvider {
  /** Jurnal va nizolar uchun nom (`manual`, `payme`, `click`). */
  readonly name: string;

  send(params: {
    /** Chiqariladigan summa. Doim musbat. */
    amount: number;
    /** Karta yoki telefon raqami — haydovchi so'rovda ko'rsatgan. */
    destination: string;
    /** So'rov identifikatori — provayder tomonida idempotentlik kaliti. */
    withdrawalId: string;
  }): Promise<PayoutResult>;
}

/** DI tokeni — interfeys ish vaqtida mavjud emas. */
export const PAYOUT_PROVIDER = Symbol('PAYOUT_PROVIDER');
