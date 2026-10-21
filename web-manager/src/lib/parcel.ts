import type { Order } from './api';
import { t } from '@/locales';

/** Mirrors backend `ParcelDetails` (modules/orders/parcel.ts). */
export interface ParcelInfo {
  recipientPhone: string;
  recipientName?: string;
  itemDescription: string;
  size: 'small' | 'medium' | 'large';
}

export function parcelSizeLabels(): Record<ParcelInfo['size'], string> {
  return t().lib.parcelSize;
}

/** The parcel payload of an order, or null for every other kind of ride. */
export function parcelInfo(order: Pick<Order, 'serviceType' | 'details'>): ParcelInfo | null {
  if (order.serviceType !== 'parcel' || !order.details) return null;
  const d = order.details as Partial<ParcelInfo>;
  if (typeof d.recipientPhone !== 'string' || typeof d.itemDescription !== 'string') return null;
  return {
    recipientPhone: d.recipientPhone,
    recipientName: typeof d.recipientName === 'string' ? d.recipientName : undefined,
    itemDescription: d.itemDescription,
    size: d.size === 'medium' || d.size === 'large' ? d.size : 'small',
  };
}
