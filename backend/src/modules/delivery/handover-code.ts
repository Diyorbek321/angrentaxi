import type { CourierTracking } from './delivery-tracking';
import type { RawQuery } from './customer-delivery-gates';

/**
 * Topshirish kodini FAQAT mijozga qaytariladigan ovqat/market buyurtmasiga
 * qo'shadi (docs/INCIDENT-POLICY.md §2). Mijoz kodni kuryerga aytadi —
 * kuryer kodsiz topshira olmaydi. Sotuvchi paneli va kuryer javobi bu
 * funksiyadan o'tmaydi. Kod faqat kuryer yo'lda bo'lganda ko'rinadi (yakunlangan,
 * bekor qilingan yoki qaytarilayotgan safarda — yo'q). Bitta `ANY` so'rovi.
 */
export async function withHandoverCodes<T extends { delivery: CourierTracking | null }>(
  query: RawQuery,
  items: T[],
): Promise<T[]> {
  const rideIds = items.map((item) => item.delivery?.orderId).filter((id): id is string => !!id);
  if (rideIds.length === 0) return items;
  const rows = (await query(
    `SELECT id, delivery_pin FROM orders
      WHERE id = ANY($1) AND status IN ('accepted', 'arrived', 'in_progress') AND delivery_failed_at IS NULL`,
    [rideIds],
  )) as Array<{ id: string; delivery_pin: string | null }>;
  const codes = new Map(rows.map((row) => [row.id, row.delivery_pin]));
  return items.map((item) =>
    item.delivery && codes.get(item.delivery.orderId)
      ? { ...item, delivery: { ...item.delivery, handoverCode: codes.get(item.delivery.orderId) ?? null } }
      : item,
  );
}
