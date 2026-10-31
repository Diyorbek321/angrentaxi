import { IntercityBookingKind, Order, OrderStatus, PaymentMethod } from '../../database/entities/order.entity';
import { revealsDriverContact } from './intercity-lifecycle-policy';
import { IntercityPriceBreakdown, intercityPriceBreakdown } from './intercity-price-breakdown';
import { IntercityTripView, IntercityTripWithRelations, toIntercityTripView } from './intercity-trip-view';

/**
 * Yo'lovchining bandi. Qatnov ko'rinishi (`IntercityTripView`) + band
 * tafsilotlari + haydovchi telefoni — faqat vaqti kelganda
 * (`revealsDriverContact`).
 */
export interface IntercityBookingView extends IntercityPriceBreakdown {
  orderId: string;
  status: OrderStatus;
  bookingKind: IntercityBookingKind | null;
  seats: number | null;
  price: number;
  paymentMethod: PaymentMethod;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  cancelReason: string | null;
  trip: IntercityTripView | null;
  driverPhone: string | null;
}

export type IntercityBookingOrder = Pick<
  Order,
  | 'id'
  | 'status'
  | 'bookingKind'
  | 'seats'
  | 'estimatedPrice'
  | 'finalPrice'
  | 'paymentMethod'
  | 'pickupAddress'
  | 'dropoffAddress'
  | 'cancelReason'
> &
  Partial<Pick<Order, 'fareBreakdown'>> & { intercityTrip?: IntercityTripWithRelations | null };

export function toIntercityBookingView(order: IntercityBookingOrder, now: Date): IntercityBookingView {
  const trip = order.intercityTrip ?? null;
  const showPhone =
    trip !== null &&
    order.status !== OrderStatus.CANCELLED &&
    revealsDriverContact(trip.status, trip.departureAt, now);
  const price = order.finalPrice ?? order.estimatedPrice;
  return {
    orderId: order.id,
    status: order.status,
    bookingKind: order.bookingKind,
    seats: order.seats,
    price,
    ...intercityPriceBreakdown(order.fareBreakdown, price),
    paymentMethod: order.paymentMethod,
    pickupAddress: order.pickupAddress,
    dropoffAddress: order.dropoffAddress,
    cancelReason: order.cancelReason,
    trip: trip ? toIntercityTripView(trip) : null,
    driverPhone: showPhone ? (trip.driver?.user?.phone ?? null) : null,
  };
}
