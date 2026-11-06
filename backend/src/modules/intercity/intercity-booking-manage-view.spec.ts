import { IntercityBookingKind, OrderStatus } from '../../database/entities/order.entity';
import { toIntercityBookingManageView } from './intercity-booking-manage-view';

const order = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'order-1',
    passenger: { firstName: 'Jasur', lastName: 'Rahimov', phone: '+998901234567' },
    seats: 2,
    bookingKind: IntercityBookingKind.SEAT,
    status: OrderStatus.SCHEDULED,
    pickupAddress: 'Angren, Navoiy 12',
    dropoffAddress: 'Rohat krugi',
    estimatedPrice: 50000,
    createdAt: new Date('2026-10-17T05:00:00.000Z'),
    updatedAt: new Date('2026-10-17T06:00:00.000Z'),
    cancelReason: null,
    ...overrides,
  }) as never;

describe('toIntercityBookingManageView', () => {
  it("dispetcherga yo'lovchi ismi va telefoni, joylar, manzillar", () => {
    expect(toIntercityBookingManageView(order())).toEqual({
      orderId: 'order-1',
      passenger: { name: 'Jasur Rahimov', phone: '+998901234567' },
      seats: 2,
      bookingKind: 'seat',
      status: 'scheduled',
      pickupAddress: 'Angren, Navoiy 12',
      dropoffAddress: 'Rohat krugi',
      price: 50000,
      createdAt: '2026-10-17T05:00:00.000Z',
      cancelledAt: null,
      cancelReason: null,
    });
  });

  it("bekor qilingan band — sabab va lahza (oxirgi yangilanish)", () => {
    const view = toIntercityBookingManageView(
      order({ status: OrderStatus.CANCELLED, cancelReason: "Yo'lovchi kelmadi" }),
    );
    expect(view.cancelledAt).toBe('2026-10-17T06:00:00.000Z');
    expect(view.cancelReason).toBe("Yo'lovchi kelmadi");
  });

  it("yo'lovchi yuklanmagan bo'lsa — bo'sh qiymatlar, yiqilmaydi", () => {
    expect(toIntercityBookingManageView(order({ passenger: undefined })).passenger).toEqual({ name: '', phone: null });
  });
});
