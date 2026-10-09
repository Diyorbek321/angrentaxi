import { RealtimeGateway } from './realtime.gateway';
import { UserRole, UserStatus } from '../../database/entities/user.entity';

/**
 * Haydovchi joylashuvi buyurtma xonasiga (`order:<id>`) qanday tarqaladi.
 *
 * Xonani yo'lovchi ham, ovqat/market mijozi ham (kuryer safari uning nomida)
 * tinglaydi va xaritadagi mashina SHU paketlardan chiziladi. Shuning uchun:
 *   1. Paketda `orderId` bor — bir vaqtda ikki buyurtmani kuzatayotgan ilova
 *      (masalan taksi + ovqat) ularni aralashtirib yubormaydi.
 *   2. Faqat buyurtmaga BIRIKTIRILGAN haydovchi xonaga yoza oladi — begona
 *      haydovchi mijozga soxta mashina ko'rsata olmaydi.
 */
describe('RealtimeGateway — driver:location buyurtma xonasiga', () => {
  const DRIVER_USER = { id: 'user-driver-1', role: UserRole.DRIVER, status: UserStatus.ACTIVE };

  let gateway: RealtimeGateway;
  let orderRepository: { findOne: jest.Mock };
  let emitted: Array<{ room: string; event: string; data: unknown }>;

  function socket(id = 'sock-1') {
    return { id, user: DRIVER_USER } as never;
  }

  beforeEach(() => {
    emitted = [];
    orderRepository = {
      findOne: jest.fn(async () => ({ id: 'ride-1', driverId: DRIVER_USER.id })),
    };
    gateway = new RealtimeGateway(
      {} as never,
      {} as never,
      {
        updateLocation: jest.fn(async () => undefined),
        findByUserId: jest.fn(async () => ({ id: 'driver-1' })),
      } as never,
      {} as never,
      {} as never,
      orderRepository as never,
    );
    (gateway as unknown as { server: unknown }).server = {
      to: (room: string) => ({
        emit: (event: string, data: unknown) => emitted.push({ room, event, data }),
      }),
    };
  });

  const toOrderRoom = () => emitted.filter((e) => e.room.startsWith('order:'));

  it('biriktirilgan haydovchi paketini orderId bilan tarqatadi', async () => {
    await gateway.handleDriverLocation(socket(), { lat: 41.01, lng: 70.14, orderId: 'ride-1' });

    expect(toOrderRoom()).toEqual([
      {
        room: 'order:ride-1',
        event: 'driver:location',
        data: expect.objectContaining({
          lat: 41.01,
          lng: 70.14,
          orderId: 'ride-1',
          driverId: DRIVER_USER.id,
        }),
      },
    ]);
  });

  it('begona buyurtma xonasiga yozmaydi', async () => {
    orderRepository.findOne.mockResolvedValue({ id: 'ride-1', driverId: 'someone-else' });

    await gateway.handleDriverLocation(socket(), { lat: 41.01, lng: 70.14, orderId: 'ride-1' });

    expect(toOrderRoom()).toEqual([]);
  });

  it("har paketda bazaga bormaydi — tekshiruv keshlanadi", async () => {
    await gateway.handleDriverLocation(socket(), { lat: 41.01, lng: 70.14, orderId: 'ride-1' });
    await gateway.handleDriverLocation(socket(), { lat: 41.02, lng: 70.15, orderId: 'ride-1' });

    expect(orderRepository.findOne).toHaveBeenCalledTimes(1);
    expect(toOrderRoom()).toHaveLength(2);
  });
});
