import type { Order } from '@/lib/api';
import {
  addressDetailLines,
  isCustomerCancelled,
  orderDiscounts,
  rideV5Fields,
  type OrderV5Fields,
} from '@/lib/order-extras';
import { DetailCard } from '@/components/ui/KeyValue';
import { AddressDetailsBlock, CustomerCancelNotice, DiscountLines } from './OrderExtras';

/**
 * Ovqat/market buyurtmasining v5 tafsilotlari (docs/specs/food-market-ux-v5.md):
 * mijoz bekor qilgani, manzil tafsilotlari, aksiya/promokod chegirmalari.
 * Hech biri bo'lmasa — hech narsa chizilmaydi (taksi safarlari uchun ham).
 */
export function deliveryExtras(order: Order): { fields: OrderV5Fields & { status: string }; hasContent: boolean } {
  const fields = { ...rideV5Fields(order as unknown as Parameters<typeof rideV5Fields>[0]), status: String(order.status) };
  const hasContent =
    isCustomerCancelled(fields) ||
    addressDetailLines(fields.addressDetails).length > 0 ||
    orderDiscounts(fields).hasAny;
  return { fields, hasContent };
}

export function DeliveryExtrasContent({ order }: { order: Order }) {
  const { fields, hasContent } = deliveryExtras(order);
  if (!hasContent) return null;
  return (
    <div className="flex flex-col gap-3">
      <CustomerCancelNotice order={fields} />
      <AddressDetailsBlock details={fields.addressDetails} />
      <DiscountLines order={fields} />
    </div>
  );
}

export function DeliveryExtrasCard({ order, className }: { order: Order; className?: string }) {
  if (!deliveryExtras(order).hasContent) return null;
  return (
    <DetailCard title="Yetkazish tafsilotlari" className={className}>
      <DeliveryExtrasContent order={order} />
    </DetailCard>
  );
}
