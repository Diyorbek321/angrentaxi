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

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  created: 'Created',
  searching: 'Searching',
  accepted: 'Accepted',
  arrived: 'Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  created: 'bg-gray-600 text-gray-100',
  searching: 'bg-blue-600 text-blue-100',
  accepted: 'bg-green-600 text-green-100',
  arrived: 'bg-yellow-600 text-yellow-100',
  in_progress: 'bg-orange-600 text-orange-100',
  completed: 'bg-emerald-600 text-emerald-100',
  cancelled: 'bg-red-600 text-red-100',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  wallet: 'Wallet',
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
