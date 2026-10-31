import { OrderStatus } from '../../database/entities/order.entity';
import { Order } from '../../database/entities/order.entity';
import { courierTracking } from './delivery-tracking';

/** `findByIdOrThrow` dan qaytgan, `attachDisplayFields` boyitgan safar. */
function ride(overrides: Record<string, unknown> = {}): Order {
  return {
    id: 'ride-1',
    status: OrderStatus.ACCEPTED,
    driver: {
      firstName: 'Bobur',
      lastName: 'Aliyev',
      phone: '+998901234567',
      carModel: 'Cobalt',
      carNumber: '01 A 777 BB',
    },
    pickup: { address: 'Osh Markazi', lat: 41.01, lng: 70.14 },
    dropoff: { address: 'Uy', lat: 41.02, lng: 70.15 },
    ...overrides,
  } as unknown as Order;
}

describe('courierTracking', () => {
  it('mijoz xaritasi uchun kuryer, mashina va ikki nuqtani qaytaradi', () => {
    expect(courierTracking(ride())).toEqual({
      orderId: 'ride-1',
      status: OrderStatus.ACCEPTED,
      driverName: 'Bobur Aliyev',
      driverPhone: '+998901234567',
      carModel: 'Cobalt',
      carNumber: '01 A 777 BB',
      pickup: { address: 'Osh Markazi', lat: 41.01, lng: 70.14 },
      dropoff: { address: 'Uy', lat: 41.02, lng: 70.15 },
    });
  });

  it('kuryer hali topilmagan bo\'lsa kuryer maydonlari null', () => {
    const result = courierTracking(ride({ driver: null, status: OrderStatus.SEARCHING }));

    expect(result).toMatchObject({
      status: OrderStatus.SEARCHING,
      driverName: null,
      driverPhone: null,
      carModel: null,
      carNumber: null,
    });
  });

  it('koordinatasi yo\'q nuqtani null qiladi — xaritaga (0,0) tushmasin', () => {
    const result = courierTracking(ride({ pickup: { address: 'X', lat: null, lng: null } }));

    expect(result.pickup).toBeNull();
    expect(result.dropoff).toEqual({ address: 'Uy', lat: 41.02, lng: 70.15 });
  });
});
