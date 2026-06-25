export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';

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

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  searching: 'bg-blue-100 text-blue-800',
  accepted: 'bg-indigo-100 text-indigo-800',
  arriving: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
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
  online: 'bg-green-100 text-green-800',
  offline: 'bg-gray-100 text-gray-800',
  blocked: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
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
