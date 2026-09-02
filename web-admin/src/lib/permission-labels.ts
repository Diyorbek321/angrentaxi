import type { Permission } from './api';

/**
 * Ruxsat nomlarining O'ZBEKCHA xaritasi — UI faqat shu fayldan o'qiydi.
 *
 * `lib/api.ts` dagi `PERMISSION_LABELS` inglizcha va muzlatilgan (API
 * qatlami tegilmaydi). Panel "bir tilda gapiradi" qoidasi (manager-panel
 * doktrina) uchun tarjima shu yerda markazlashtiriladi — sahifalar ichida
 * hech qachon inline tarjima qilinmaydi.
 */

/** To'liq yorliq — ruxsat tahrirlash modalidagi checkbox yozuvi. */
export const PERMISSION_LABELS_UZ: Record<Permission, string> = {
  dispatch: "Dispetcherlik — jonli monitor, istisnolar, qo'lda biriktirish, audit jurnali",
  drivers_view: "Haydovchilar ro'yxatini ko'rish",
  drivers_approve: 'Haydovchi KYC hujjatlarini tasdiqlash',
  drivers_finance: "Haydovchi balansi va komissiya foizini o'zgartirish",
  tariffs_manage: "Tarif o'zgarishini taklif qilish, surge, komissiyani ko'rish",
  promo_manage: "Promo kodlarni ko'rish va yaratish",
  bonuses_view: "Bonus qoidalari va progressini ko'rish",
  support_manage: "Qo'llab-quvvatlash murojaatlarini boshqarish",
  withdrawals_view: "Pul yechish navbatini ko'rish",
  users_view: "Foydalanuvchilar ro'yxatini ko'rish",
};

/** Qisqa yorliq — jadval badge'lari va chiplar uchun (1–2 so'z). */
export const PERMISSION_SHORT_LABELS_UZ: Record<Permission, string> = {
  dispatch: 'Dispetcherlik',
  drivers_view: 'Haydovchilar',
  drivers_approve: 'KYC tasdiqlash',
  drivers_finance: 'Haydovchi moliyasi',
  tariffs_manage: 'Tariflar',
  promo_manage: 'Promo kodlar',
  bonuses_view: 'Bonuslar',
  support_manage: 'Yordam',
  withdrawals_view: 'Pul yechish',
  users_view: 'Foydalanuvchilar',
};

export interface PermissionGroup {
  /** Domen sarlavhasi — checkbox guruhining nomi. */
  title: string;
  permissions: Permission[];
}

/**
 * Ruxsatlar domen bo'yicha guruhlanadi — 10 ta yassi checkbox o'rniga
 * operator "qaysi bo'limga kira oladi" deb o'ylaydi. Har bir ruxsat
 * AYNAN BITTA guruhda turadi (testda tekshiriladi).
 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  { title: 'Operatsiyalar', permissions: ['dispatch'] },
  { title: 'Haydovchilar', permissions: ['drivers_view', 'drivers_approve', 'drivers_finance'] },
  { title: 'Moliya', permissions: ['tariffs_manage', 'withdrawals_view', 'bonuses_view'] },
  { title: 'Marketing', permissions: ['promo_manage'] },
  { title: 'Mijozlar va yordam', permissions: ['users_view', 'support_manage'] },
];
