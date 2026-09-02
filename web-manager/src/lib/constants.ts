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
 * Status accent colour — the ONE lifecycle ramp, used identically by the feed
 * cards, the orders table and the map legend:
 *
 *   created (neutral) → searching (animated mint — the machine working) →
 *   accepted (info blue) → arrived (mint light) → in_progress (mint) →
 *   completed (deep green) → cancelled (red).
 *
 * `searching` is the only animated state, and it is mint on purpose: mint =
 * the system is driving. Amber is reserved for manual override alone — if it
 * also meant "searching", the audit trail would lose its visual language.
 */
export const ORDER_STATUS_ACCENT: Record<OrderStatus, string> = {
  created: 'bg-line-strong',
  searching: 'bg-mint-deep animate-pulse',
  accepted: 'bg-info',
  arrived: 'bg-primary-300',
  in_progress: 'bg-primary',
  completed: 'bg-primary-700',
  cancelled: 'bg-danger',
};

/**
 * Map marker colours. Leaflet takes colours as inline SVG/DOM styles, so the
 * hexes live here (next to the class-based ramp above) instead of Tailwind
 * classes — same source of truth, two render targets.
 *
 * Values come straight from docs/DESIGN-TOKENS.md:
 * - available = `mint-deep` #10A064 — the mint that stays visible on light
 *   ground (3.37:1 non-text; raw mint #1FCA8E is 2.12:1 and may not carry
 *   meaning on light surfaces).
 * - busy      = `ink-subtle` #78888F — busy drivers stay visible but recede.
 * - dropoff   = `danger` #E5484D (kError).
 * - markerInk = `on-mint` #06231A — icon glyph on both marker fills.
 */
export const MAP_COLORS = {
  available: '#10A064',
  busy: '#78888F',
  dropoff: '#E5484D',
  route: '#10A064',
  markerInk: '#06231A',
} as const;

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
