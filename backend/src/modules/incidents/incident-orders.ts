import type { IncidentVertical } from '../../database/entities/incident.entity';

/**
 * Hodisa buyurtmasining ishtirokchilari va tugash vaqti — uch xil jadvaldan
 * bitta shaklga (INCIDENT-POLICY §3: "dalil buyurtmaga bog'lanadi").
 */
export interface IncidentOrderContext {
  vertical: IncidentVertical;
  orderId: string;
  /** Taksi/posilka/yuk safari yoki ovqat/market kuryer safari (`orders.id`) — baho, SOS, iz shu yerda. */
  rideOrderId: string | null;
  customerId: string;
  /** Haydovchi/kuryer `users.id`. */
  driverUserId: string | null;
  /** Restoran/do'kon egasi `users.id`. */
  vendorOwnerId: string | null;
  vendorName: string | null;
  status: string;
  /** Yakunlangan/bekor qilingan vaqt; davom etayotgan bo'lsa `null`. */
  endedAt: Date | null;
  /** Safar hozir davom etmoqda (xavfsizlik shikoyati uchun). */
  active: boolean;
  serviceType: string | null;
  paymentMethod: string | null;
  totalPrice: number | null;
  refundStatus: string | null;
  refundDue: number | null;
}

export type RawQuery = (sql: string, params: unknown[]) => Promise<unknown>;

const RIDE_ENDED = ['completed', 'cancelled'];
const RIDE_ACTIVE = ['accepted', 'arrived', 'in_progress'];
const VENDOR_ENDED = ['delivered', 'cancelled', 'returned'];

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export async function loadIncidentOrder(
  query: RawQuery,
  vertical: IncidentVertical,
  orderId: string,
): Promise<IncidentOrderContext | null> {
  if (vertical === 'taxi') {
    const rows = (await query(
      `SELECT id, passenger_id, driver_id, status, completed_at, updated_at, service_type, payment_method,
              COALESCE(final_price, estimated_price) AS price
         FROM orders WHERE id = $1`,
      [orderId],
    )) as Row[];
    const r = rows?.[0];
    if (!r) return null;
    const status = String(r.status);
    return {
      vertical,
      orderId,
      rideOrderId: orderId,
      customerId: String(r.passenger_id),
      driverUserId: str(r.driver_id),
      vendorOwnerId: null,
      vendorName: null,
      status,
      endedAt: RIDE_ENDED.includes(status) ? new Date((r.completed_at ?? r.updated_at) as string) : null,
      active: RIDE_ACTIVE.includes(status),
      serviceType: str(r.service_type),
      paymentMethod: str(r.payment_method),
      totalPrice: num(r.price),
      refundStatus: null,
      refundDue: null,
    };
  }
  const table = vertical === 'food' ? 'food_orders' : 'market_orders';
  const vendorTable = vertical === 'food' ? 'restaurants' : 'stores';
  const vendorFk = vertical === 'food' ? 'restaurant_id' : 'store_id';
  const rows = (await query(
    `SELECT v.id, v.customer_id, v.status, v.updated_at, v.delivery_order_id, v.payment_method, v.total_price,
            v.refund_status, v.refund_due, s.owner_user_id, s.name AS vendor_name, o.driver_id
       FROM ${table} v
       JOIN ${vendorTable} s ON s.id = v.${vendorFk}
       LEFT JOIN orders o ON o.id = v.delivery_order_id
      WHERE v.id = $1`,
    [orderId],
  )) as Row[];
  const r = rows?.[0];
  if (!r) return null;
  const status = String(r.status);
  return {
    vertical,
    orderId,
    rideOrderId: str(r.delivery_order_id),
    customerId: String(r.customer_id),
    driverUserId: str(r.driver_id),
    vendorOwnerId: str(r.owner_user_id),
    vendorName: str(r.vendor_name),
    status,
    endedAt: VENDOR_ENDED.includes(status) ? new Date(r.updated_at as string) : null,
    active: !VENDOR_ENDED.includes(status),
    serviceType: vertical,
    paymentMethod: str(r.payment_method),
    totalPrice: num(r.total_price),
    refundStatus: str(r.refund_status),
    refundDue: num(r.refund_due),
  };
}

export type OrderParty = 'customer' | 'driver' | 'vendor';

/** Foydalanuvchi bu buyurtmada kim (mijoz ustun — menejer o'zi buyurtma bergan bo'lishi mumkin). */
export function partyOf(ctx: IncidentOrderContext, userId: string): OrderParty | null {
  if (ctx.customerId === userId) return 'customer';
  if (ctx.driverUserId === userId) return 'driver';
  if (ctx.vendorOwnerId === userId) return 'vendor';
  return null;
}
