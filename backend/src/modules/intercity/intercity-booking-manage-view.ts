import { IntercityBookingKind, Order, OrderStatus } from '../../database/entities/order.entity';
import { User } from '../../database/entities/user.entity';

/**
 * Dispetcher/admin uchun qatnov bandi (`GET intercity/trips/:id/bookings/manage`).
 * ⚠️ Yo'lovchi telefoni bor — faqat MANAGER/ADMIN + DISPATCH yo'lida.
 */
export interface IntercityBookingManageView {
  orderId: string;
  passenger: { name: string; phone: string | null };
  seats: number | null;
  bookingKind: IntercityBookingKind | null;
  status: OrderStatus;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  price: number;
  createdAt: string;
  /**
   * `orders` da alohida `cancelled_at` yo'q — bekor qilingan bandda bu
   * oxirgi yangilanish lahzasi (bekor holatidan keyin band o'zgarmaydi).
   */
  cancelledAt: string | null;
  cancelReason: string | null;
}

export function toIntercityBookingManageView(order: Order & { passenger?: User }): IntercityBookingManageView {
  const passenger = order.passenger;
  const name = [passenger?.firstName, passenger?.lastName].filter(Boolean).join(' ');
  const cancelled = order.status === OrderStatus.CANCELLED;
  return {
    orderId: order.id,
    passenger: { name, phone: passenger?.phone ?? null },
    seats: order.seats ?? null,
    bookingKind: order.bookingKind ?? null,
    status: order.status,
    pickupAddress: order.pickupAddress ?? null,
    dropoffAddress: order.dropoffAddress ?? null,
    price: Number(order.estimatedPrice),
    createdAt: new Date(order.createdAt).toISOString(),
    cancelledAt: cancelled ? new Date(order.updatedAt).toISOString() : null,
    cancelReason: order.cancelReason ?? null,
  };
}
