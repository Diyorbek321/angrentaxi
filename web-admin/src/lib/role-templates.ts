import type { Permission } from './api';
import { t } from '@/locales';

/**
 * Rol — ish nomi bilan atalgan ruxsatlar to'plami (manager-panel-design,
 * rbac-and-audit). Backend'da alohida rol yo'q: Operator va Moliya ham
 * MANAGER, shablon faqat checkbox'larni bir bosishda to'ldiradi. Admin keyin
 * istalgan ruxsatni qo'shib/olib tashlashi mumkin — u holda xodim "qo'lda
 * sozlangan" bo'ladi.
 */
export type RoleTemplateId = 'operator' | 'finance';

export interface RoleTemplate {
  id: RoleTemplateId;
  label: string;
  description: string;
  permissions: readonly Permission[];
}

/** Pulni platformadan chiqaradigan ruxsatlar — alohida ogohlantirish bilan beriladi. */
export const MONEY_OUT_PERMISSIONS: readonly Permission[] = ['withdrawals_approve'];

const TEMPLATE_PERMISSIONS: Record<RoleTemplateId, readonly Permission[]> = {
  // Jonli dispetcherlik, haydovchilar va murojaatlar — pulga tegmaydi.
  operator: ['dispatch', 'drivers_view', 'drivers_approve', 'support_manage', 'users_view'],
  // Pul yechish navbati va tasdiqlash, haydovchi balansi, bonuslar.
  finance: ['withdrawals_view', 'withdrawals_approve', 'drivers_view', 'drivers_finance', 'bonuses_view'],
};

export function roleTemplates(): RoleTemplate[] {
  const m = t().staff.roleTemplates;
  return (Object.keys(TEMPLATE_PERMISSIONS) as RoleTemplateId[]).map((id) => ({
    id,
    label: m[id].label,
    description: m[id].description,
    permissions: TEMPLATE_PERMISSIONS[id],
  }));
}

/** Ruxsatlar biror shablonga AYNAN mos kelsa — o'sha shablon, aks holda null. */
export function matchRoleTemplate(permissions: readonly Permission[]): RoleTemplate | null {
  const set = new Set(permissions);
  return (
    roleTemplates().find(
      (tpl) => tpl.permissions.length === set.size && tpl.permissions.every((p) => set.has(p)),
    ) ?? null
  );
}
