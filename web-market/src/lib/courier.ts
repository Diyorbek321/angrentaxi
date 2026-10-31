import { t } from '@/locales';

/**
 * Courier ride attached to a vendor order (backend `withDelivery`).
 * `status` is the ride's order status: created → searching → accepted →
 * arrived → in_progress → completed, or cancelled.
 */
export interface DeliveryInfo {
  orderId: string;
  status: string;
  driverName: string | null;
  driverPhone: string | null;
}

export type CourierTone = 'waiting' | 'active' | 'done' | 'failed';

export interface CourierState {
  tone: CourierTone;
  label: string;
  /** Show "Qayta chaqirish": the last ride ended without a courier. */
  canRedispatch: boolean;
}

/**
 * What the kitchen should see about the courier. `null` delivery on a ready
 * order means dispatch never happened (e.g. coordinates were missing), which
 * the vendor can also fix by re-dispatching.
 */
export function courierState(delivery: DeliveryInfo | null | undefined): CourierState {
  const m = t().courier;
  if (!delivery) {
    return { tone: 'failed', label: m.notCalled, canRedispatch: true };
  }
  switch (delivery.status) {
    case 'created':
    case 'searching':
      return { tone: 'waiting', label: m.searching, canRedispatch: false };
    case 'accepted':
      return { tone: 'active', label: m.coming, canRedispatch: false };
    case 'arrived':
      return { tone: 'active', label: m.arrived, canRedispatch: false };
    case 'in_progress':
      return { tone: 'active', label: m.onTheWay, canRedispatch: false };
    case 'completed':
      return { tone: 'done', label: m.delivered, canRedispatch: false };
    case 'cancelled':
      return { tone: 'failed', label: m.notFound, canRedispatch: true };
    default:
      return { tone: 'waiting', label: m.unknown, canRedispatch: false };
  }
}
