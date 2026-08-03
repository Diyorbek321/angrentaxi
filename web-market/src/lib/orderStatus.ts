import type { MarketOrderStatus, ProductStatus, DeliveryMode } from './api';

/**
 * Single source of truth for every status the vendor sees: label, colour and
 * ordering. Pages import from here — translations must never be re-typed at a
 * call site, or the panel starts disagreeing with itself.
 */

export interface StatusMeta {
  label: string;
  /** Badge / chip classes — theme-aware, readable in light and dark. */
  chip: string;
  /** Solid colour for column headers, dots and card accents. */
  dot: string;
  /** Accent border for the kanban column and its cards. */
  accent: string;
  /** Text-only colour, for values printed on a plain surface. */
  text: string;
}

export const ORDER_STATUS_META: Record<MarketOrderStatus, StatusMeta> = {
  // Mint on purpose: `new` is the one status the vendor must not miss, so it
  // wears the brand colour while everything else stays informational.
  new: {
    label: 'Yangi',
    chip: 'bg-primary/12 text-primary-700 dark:text-primary-300 border border-primary/30',
    dot: 'bg-primary',
    accent: 'border-primary/45',
    text: 'text-primary-700 dark:text-primary-300',
  },
  packing: {
    label: "Yig'ilmoqda",
    chip: 'bg-packing/12 text-packing-dark dark:text-packing-light border border-packing/30',
    dot: 'bg-packing',
    accent: 'border-packing/40',
    text: 'text-packing-dark dark:text-packing-light',
  },
  shipped: {
    label: 'Yuborildi',
    chip: 'bg-shipped/12 text-shipped-dark dark:text-shipped-light border border-shipped/30',
    dot: 'bg-shipped',
    accent: 'border-shipped/40',
    text: 'text-shipped-dark dark:text-shipped-light',
  },
  delivered: {
    label: 'Yetkazildi',
    chip: 'bg-delivered/12 text-delivered dark:text-delivered-light border border-delivered/30',
    dot: 'bg-delivered',
    accent: 'border-delivered/40',
    text: 'text-delivered dark:text-delivered-light',
  },
  cancelled: {
    label: 'Bekor qilindi',
    chip: 'bg-danger/12 text-danger border border-danger/30',
    dot: 'bg-danger',
    accent: 'border-danger/35',
    text: 'text-danger',
  },
};

/**
 * The lifecycle, in order. `advanceOrder` walks this list one step at a time —
 * the backend rejects skips, so the UI never offers one.
 */
export const ORDER_FLOW: MarketOrderStatus[] = ['new', 'packing', 'shipped', 'delivered'];

/** Columns shown on the kanban board, left to right. */
export const KANBAN_COLUMNS: MarketOrderStatus[] = [...ORDER_FLOW, 'cancelled'];

/** Statuses that still need the vendor's hands. */
export const OPEN_ORDER_STATUSES: MarketOrderStatus[] = ['new', 'packing', 'shipped'];

export function orderStatusMeta(status: MarketOrderStatus | string): StatusMeta {
  return ORDER_STATUS_META[status as MarketOrderStatus] ?? ORDER_STATUS_META.new;
}

/** Next status in the flow, or null when the order is finished. */
export function nextOrderStatus(status: MarketOrderStatus): MarketOrderStatus | null {
  const i = ORDER_FLOW.indexOf(status);
  if (i === -1 || i === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[i + 1];
}

/** Label for the button that moves an order forward. */
export function advanceLabel(status: MarketOrderStatus): string | null {
  switch (status) {
    case 'new':
      return "Yig'ishni boshlash";
    case 'packing':
      return 'Yuborildi deb belgilash';
    case 'shipped':
      return 'Yetkazildi deb belgilash';
    default:
      return null;
  }
}

// ─── Product status ────────────────────────────────────────────────

export const PRODUCT_STATUS_META: Record<ProductStatus, StatusMeta> = {
  active: {
    label: 'Faol',
    chip: 'bg-primary/12 text-primary-700 dark:text-primary-300 border border-primary/30',
    dot: 'bg-primary',
    accent: 'border-primary/40',
    text: 'text-primary-700 dark:text-primary-300',
  },
  // Warning colour, and only here: an out-of-stock product is lost revenue.
  out: {
    label: 'Zaxira tugagan',
    chip: 'bg-danger/12 text-danger border border-danger/30',
    dot: 'bg-danger',
    accent: 'border-danger/35',
    text: 'text-danger',
  },
  hidden: {
    label: 'Yashirilgan',
    chip: 'bg-surface-2 text-muted border border-line',
    dot: 'bg-line-strong',
    accent: 'border-line',
    text: 'text-muted',
  },
};

export function productStatusMeta(status: ProductStatus | string): StatusMeta {
  return PRODUCT_STATUS_META[status as ProductStatus] ?? PRODUCT_STATUS_META.hidden;
}

// ─── Delivery ──────────────────────────────────────────────────────

export const DELIVERY_MODE_LABEL: Record<DeliveryMode, string> = {
  self: "Do'kon o'zi yetkazadi",
  platform: 'Platforma kuryeri',
};

/** Short form for cards, where the full sentence does not fit. */
export const DELIVERY_MODE_SHORT: Record<DeliveryMode, string> = {
  self: "O'zi yetkazadi",
  platform: 'Kuryer',
};

// ─── Store ─────────────────────────────────────────────────────────

export const STORE_STATUS_LABEL: Record<'active' | 'closed', string> = {
  active: 'Ochiq',
  closed: 'Yopiq',
};
