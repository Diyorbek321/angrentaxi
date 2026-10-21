import type { Permission } from './api';
import { t } from '@/locales';

/**
 * Ruxsat nomlari (faol tilda, `locales/{uz,ru}/staff.ts`) — UI faqat shu fayldan o'qiydi.
 *
 * `lib/api.ts` dagi `PERMISSION_LABELS` inglizcha va muzlatilgan (API
 * qatlami tegilmaydi). Panel "bir tilda gapiradi" qoidasi (manager-panel
 * doktrina) uchun tarjima shu yerda markazlashtiriladi — sahifalar ichida
 * hech qachon inline tarjima qilinmaydi.
 */

/** To'liq yorliq — ruxsat tahrirlash modalidagi checkbox yozuvi. */
export function permissionLabels(): Record<Permission, string> {
  return t().staff.permissionLabels;
}

/** Qisqa yorliq — jadval badge'lari va chiplar uchun (1–2 so'z). */
export function permissionShortLabels(): Record<Permission, string> {
  return t().staff.permissionShortLabels;
}

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
export function permissionGroups(): PermissionGroup[] {
  const g = t().staff.permissionGroups;
  return [
    { title: g.operations, permissions: ['dispatch'] },
    { title: g.drivers, permissions: ['drivers_view', 'drivers_approve', 'drivers_finance'] },
    { title: g.finance, permissions: ['tariffs_manage', 'withdrawals_view', 'bonuses_view'] },
    { title: g.marketing, permissions: ['promo_manage'] },
    { title: g.customers, permissions: ['users_view', 'support_manage'] },
  ];
}
