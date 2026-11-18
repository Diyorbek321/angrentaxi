/**
 * Huquqiy/moliya sahifalarining yorliqlari (bitta joyda). Matnlar
 * `locales/*\/compliance.ts` da; funksiyalar render paytida chaqirilsin —
 * modul darajasida emas (aks holda til almashmaydi).
 */
import type { BadgeVariant } from '@/components/ui/Badge';
import { t } from '@/locales';
import type { FiscalPrincipalType, FiscalReceiptStatus, ShiftPassStatus } from './compliance-api';

export function serviceTypeLabels(): Record<string, string> {
  return t().compliance.labels.serviceType;
}

export const SHIFT_SERVICE_TYPES = ['taxi', 'cargo', 'parcel', 'food', 'market'] as const;

export function fiscalStatusLabels(): Record<FiscalReceiptStatus, string> {
  return t().compliance.labels.fiscalStatus;
}

export const FISCAL_STATUS_BADGE: Record<FiscalReceiptStatus, BadgeVariant> = {
  pending: 'info',
  sent: 'success',
  failed: 'danger',
  skipped: 'neutral',
};

export function principalTypeLabels(): Record<FiscalPrincipalType, string> {
  return t().compliance.labels.principalType;
}

export function paymentMethodLabels(): Record<string, string> {
  return t().compliance.labels.paymentMethod;
}

export function shiftStatusLabels(): Record<ShiftPassStatus, string> {
  return t().compliance.labels.shiftStatus;
}

export const SHIFT_STATUS_BADGE: Record<ShiftPassStatus, BadgeVariant> = {
  active: 'success',
  expired: 'neutral',
  cancelled: 'muted-danger',
};

export function auditActionLabels(): Record<string, string> {
  return t().compliance.labels.auditAction;
}

export function auditTargetLabels(): Record<string, string> {
  return t().compliance.labels.auditTarget;
}

export function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '—';
  return map[key] ?? key;
}
