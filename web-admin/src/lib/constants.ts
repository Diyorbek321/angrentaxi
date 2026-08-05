// The backend URL is resolved in exactly one place now — `lib/server/api-config.ts`,
// server-side only. Re-exporting it here would put it back in the browser bundle
// for no reason; both constants were already unused.

export const ORDER_STATUSES = {
  PENDING: 'pending',
  SEARCHING: 'searching',
  ACCEPTED: 'accepted',
  ARRIVING: 'arriving',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Kutilmoqda',
  searching: 'Haydovchi qidirilmoqda',
  accepted: 'Qabul qilindi',
  arriving: 'Haydovchi yo\'lda',
  in_progress: 'Bajarilmoqda',
  completed: 'Yakunlandi',
  cancelled: 'Bekor qilindi',
};

/**
 * Angren Mint tokenlari (docs/DESIGN-TOKENS.md §3.3): tinted fon + `*-deep`
 * matn (qorong'i temada `*-light`). Holat nomi har doim MATN bilan ham
 * beriladi, shuning uchun rang yolg'iz ma'no tashimaydi.
 */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-override-tint text-override-dark dark:text-override-light border border-override/30',
  searching: 'bg-info-tint text-info-deep dark:text-info-light border border-info/30',
  accepted: 'bg-info-tint text-info-deep dark:text-info-light border border-info/30',
  arriving: 'bg-violet-tint text-violet-deep dark:text-violet-light border border-violet/30',
  in_progress: 'bg-mint-tint text-primary-text border border-mint/30',
  completed: 'bg-mint-tint text-primary-text border border-mint/40',
  cancelled: 'bg-danger-tint text-danger-deep dark:text-danger-light border border-danger/30',
};

export const DRIVER_STATUSES = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  BLOCKED: 'blocked',
  PENDING: 'pending',
} as const;

export type DriverStatus = (typeof DRIVER_STATUSES)[keyof typeof DRIVER_STATUSES];

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  online: 'Onlayn',
  offline: 'Oflayn',
  blocked: 'Bloklangan',
  pending: 'Ko\'rib chiqilmoqda',
};

export const DRIVER_STATUS_COLORS: Record<DriverStatus, string> = {
  online: 'bg-mint-tint text-primary-text border border-mint/40',
  offline: 'bg-surface-2 text-muted border border-line',
  blocked: 'bg-danger-tint text-danger-deep dark:text-danger-light border border-danger/30',
  pending: 'bg-override-tint text-override-dark dark:text-override-light border border-override/30',
};

export const USER_ROLES = {
  ADMIN: 'admin',
  PASSENGER: 'passenger',
  DRIVER: 'driver',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  passenger: 'Yo\'lovchi',
  driver: 'Haydovchi',
};

export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  UZCARD: 'uzcard',
  HUMO: 'humo',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Naqd',
  card: 'Karta',
  uzcard: 'UzCard',
  humo: 'Humo',
};

export const DATE_RANGES = {
  LAST_7_DAYS: '7d',
  LAST_30_DAYS: '30d',
  CUSTOM: 'custom',
} as const;

export const PAGE_SIZE = 20;
