/**
 * Yetkazish manzili tafsilotlari (migratsiya 031, docs/specs/food-market-ux-v5.md §3).
 * Ovqat/market buyurtmasida va saqlangan manzilda (`favorite_addresses`) jsonb.
 */
export interface AddressDetails {
  /** Podyezd, ≤ 10 */
  entrance?: string;
  /** Qavat, ≤ 10 */
  floor?: string;
  /** Xonadon, ≤ 10 */
  apartment?: string;
  /** Domofon, ≤ 20 */
  intercom?: string;
  /** Mo'ljal, ≤ 120 */
  landmark?: string;
  /** Kuryerga izoh, ≤ 200 */
  courierNote?: string;
}

/** Ovqat/market buyurtmasini kim bekor qildi. */
export type VendorOrderCancelledBy = 'customer' | 'vendor';
