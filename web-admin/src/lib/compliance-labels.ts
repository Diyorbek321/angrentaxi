/** Huquqiy/moliya sahifalarining o'zbekcha yorliqlari (bitta joyda). */
import type { BadgeVariant } from '@/components/ui/Badge';
import type { FiscalPrincipalType, FiscalReceiptStatus, ShiftPassStatus } from './compliance-api';

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  taxi: 'Taksi',
  cargo: 'Yuk',
  food: 'Ovqat',
  market: 'Market',
  parcel: 'Posilka',
  shift_pass: 'Smena',
  restaurant: 'Restoran',
  store: "Do'kon",
  order: 'Taksi safari',
  food_order: 'Ovqat buyurtmasi',
  market_order: 'Market buyurtmasi',
};

export const SHIFT_SERVICE_TYPES = ['taxi', 'cargo', 'parcel', 'food', 'market'] as const;

export const FISCAL_STATUS_LABELS: Record<FiscalReceiptStatus, string> = {
  pending: 'Kutilmoqda',
  sent: 'Yuborildi',
  failed: 'Xato',
  skipped: "O'tkazib yuborildi",
};

export const FISCAL_STATUS_BADGE: Record<FiscalReceiptStatus, BadgeVariant> = {
  pending: 'info',
  sent: 'success',
  failed: 'danger',
  skipped: 'neutral',
};

export const PRINCIPAL_TYPE_LABELS: Record<FiscalPrincipalType, string> = {
  driver: 'Haydovchi',
  restaurant: 'Restoran',
  store: "Do'kon",
  platform: 'Platforma',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Naqd',
  card: 'Karta',
};

export const SHIFT_STATUS_LABELS: Record<ShiftPassStatus, string> = {
  active: 'Faol',
  expired: 'Tugagan',
  cancelled: 'Bekor qilingan',
};

export const SHIFT_STATUS_BADGE: Record<ShiftPassStatus, BadgeVariant> = {
  active: 'success',
  expired: 'neutral',
  cancelled: 'muted-danger',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'wallet.manual_adjustment': "Hamyonni qo'lda tuzatish",
  'shift_pass.cancel': 'Smenani bekor qilish',
  'vendor.tin_update': "Sotuvchi STIR'ini o'zgartirish",
  'payment.refund_clawback': 'Karta qaytarimi — ulushni qaytarib olish',
};

export const AUDIT_TARGET_LABELS: Record<string, string> = {
  driver: 'Haydovchi',
  shift_pass: 'Smena',
  restaurant: 'Restoran',
  store: "Do'kon",
  order: 'Taksi safari',
  food_order: 'Ovqat buyurtmasi',
  market_order: 'Market buyurtmasi',
};

export function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '—';
  return map[key] ?? key;
}
