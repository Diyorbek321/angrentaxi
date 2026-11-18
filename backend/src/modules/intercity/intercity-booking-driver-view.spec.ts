import { IntercityBookingKind, OrderStatus } from '../../database/entities/order.entity';
import { IntercityDriverBookingRow, toIntercityDriverBookingView } from './intercity-booking-driver-view';
import { composeIntercityFare } from './intercity-extension';

describe('toIntercityDriverBookingView', () => {
  const row: IntercityDriverBookingRow = {
    id: 'o1',
    status: OrderStatus.ACCEPTED,
    seats: 2,
    booking_kind: IntercityBookingKind.SEAT,
    estimated_price: '50000.00',
    final_price: null,
    fare_breakdown: null,
    first_name: 'Ali',
    last_name: 'Valiyev',
    phone: '+998901112233',
    pickup_address: 'Angren, Navoiy 12',
    pickup_lat: '40.0956',
    pickup_lng: '70.9432',
    dropoff_address: 'Rohat krugi',
    dropoff_lat: '41.3111',
    dropoff_lng: '69.2797',
    created_at: new Date('2026-10-17T05:00:00Z'),
  };

  it('telefon ochiq bo\'lsa barcha maydonlarni raqam va ISO bilan qaytaradi', () => {
    expect(toIntercityDriverBookingView(row, true)).toEqual({
      orderId: 'o1',
      status: OrderStatus.ACCEPTED,
      seats: 2,
      bookingKind: IntercityBookingKind.SEAT,
      price: 50000,
      basePrice: 50000,
      extensions: [],
      passenger: { name: 'Ali Valiyev', phone: '+998901112233' },
      pickupAddress: 'Angren, Navoiy 12',
      pickupLat: 40.0956,
      pickupLng: 70.9432,
      dropoffAddress: 'Rohat krugi',
      dropoffLat: 41.3111,
      dropoffLng: 69.2797,
      createdAt: '2026-10-17T05:00:00.000Z',
    });
  });

  it('vaqti kelmagan bo\'lsa yo\'lovchi telefoni yashiriladi', () => {
    expect(toIntercityDriverBookingView(row, false).passenger.phone).toBeNull();
  });

  it('yakunlangan bandda yakuniy narx olinadi', () => {
    const view = toIntercityDriverBookingView({ ...row, status: OrderStatus.COMPLETED, final_price: '48000.00' }, true);
    expect(view.price).toBe(48000);
  });

  it('koordinata yo\'q bo\'lsa null, ism bo\'lmasa bo\'sh qator', () => {
    const view = toIntercityDriverBookingView(
      { ...row, pickup_lat: null, pickup_lng: null, first_name: null, last_name: null },
      true,
    );
    expect(view.pickupLat).toBeNull();
    expect(view.pickupLng).toBeNull();
    expect(view.passenger.name).toBe('');
  });

  it('davomli band: haydovchi JAMI naqdni va davom qatorini ko\'radi', () => {
    const extension = { side: 'dropoff' as const, pointName: 'Rohat krugi', km: 12.4, pricePerKm: 2000, fare: 25_000, estimated: false };
    const view = toIntercityDriverBookingView(
      { ...row, estimated_price: '75000.00', fare_breakdown: composeIntercityFare(50_000, [extension], 60) },
      true,
    );
    expect(view).toMatchObject({ price: 75_000, basePrice: 50_000, extensions: [extension] });
  });
});
