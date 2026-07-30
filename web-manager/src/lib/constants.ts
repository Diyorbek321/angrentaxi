export const ORDER_STATUS = {
  CREATED: 'created',
  SEARCHING: 'searching',
  ACCEPTED: 'accepted',
  ARRIVED: 'arrived',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const DRIVER_STATUS = {
  ONLINE: 'online',
  BUSY: 'busy',
  OFFLINE: 'offline',
} as const;

export type DriverStatus = (typeof DRIVER_STATUS)[keyof typeof DRIVER_STATUS];

export const PAYMENT_METHOD = {
  CASH: 'cash',
  CARD: 'card',
  WALLET: 'wallet',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

// Every user-facing status string lives here. Pages must read from these
// maps rather than writing their own Uzbek text, so a wording change is a
// one-line edit and the panel never drifts out of sync with itself.
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  created: 'Yaratildi',
  searching: 'Qidirilmoqda',
  accepted: 'Qabul qilindi',
  arrived: 'Yetib keldi',
  in_progress: 'Yoʻlda',
  completed: 'Yakunlandi',
  cancelled: 'Bekor qilindi',
};

/**
 * Status accent colour — the thin bar on order cards and the dot in legends.
 * Mint shades mean the automatic flow is progressing; amber marks the one
 * status a dispatcher may need to act on (search still running).
 */
export const ORDER_STATUS_ACCENT: Record<OrderStatus, string> = {
  created: 'bg-line-strong',
  searching: 'bg-override',
  accepted: 'bg-info',
  arrived: 'bg-primary-300',
  in_progress: 'bg-primary',
  completed: 'bg-primary-700',
  cancelled: 'bg-danger',
};

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  online: 'Boʻsh',
  busy: 'Band',
  offline: 'Oflayn',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Naqd',
  card: 'Karta',
  wallet: 'Hamyon',
};

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'created',
  'searching',
  'accepted',
  'arrived',
  'in_progress',
];

export const ROUTES = {
  LOGIN: '/login',
  DISPATCH: '/dispatch',
  ORDERS: '/orders',
  CREATE_ORDER: '/create-order',
} as const;
