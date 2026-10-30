import { WsException } from '@nestjs/websockets';
import { RealtimeGateway } from './realtime.gateway';
import { OrderStatus } from '../../database/entities/order.entity';
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
  let drivers: { updateLocation: jest.Mock; findByUserId: jest.Mock; getLastLocationByUserId: jest.Mock };
  let emitted: Array<{ room: string; event: string; data: unknown }>;

  function socket(id = 'sock-1') {
    return { id, user: DRIVER_USER } as never;
  }

  beforeEach(() => {
    emitted = [];
    orderRepository = {
      findOne: jest.fn(async () => ({ id: 'ride-1', driverId: DRIVER_USER.id })),
    };
    drivers = {
      updateLocation: jest.fn(async () => undefined),
      findByUserId: jest.fn(async () => ({ id: 'driver-1' })),
      getLastLocationByUserId: jest.fn(async () => ({ lat: 41.03, lng: 70.16 })),
    };
    gateway = new RealtimeGateway(
      {} as never,
      {} as never,
      drivers as never,
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

  it.each([
    [{ lat: 200, lng: 70.14 }],
    [{ lat: 41.01, lng: -181 }],
    [{ lat: Number.NaN, lng: 70.14 }],
  ])('chegaradan tashqari koordinata rad etiladi: %j', async (coords) => {
    await expect(
      gateway.handleDriverLocation(socket(), { ...coords, orderId: 'ride-1' }),
    ).rejects.toBeInstanceOf(WsException);

    expect(drivers.updateLocation).not.toHaveBeenCalled();
    expect(toOrderRoom()).toEqual([]);
  });

  // Yo'lovchi kutayotgan paket bazaga yozishni kutmaydi: baza sekin yoki
  // yiqilsa ham mashina xaritada yuraveradi.
  it('bazaga yozish yiqilsa ham yo\'lovchiga yetkaziladi', async () => {
    drivers.updateLocation.mockRejectedValue(new Error('db down'));

    await expect(
      gateway.handleDriverLocation(socket(), { lat: 41.01, lng: 70.14, orderId: 'ride-1' }),
    ).rejects.toThrow('db down');

    expect(toOrderRoom()).toHaveLength(1);
  });
});

/**
 * Yo'lovchi buyurtma xonasiga qo'shilganda (ilova qayta ochildi, socket
 * qayta ulandi) haydovchining OXIRGI joyi darhol yuboriladi. Ilgari mashina
 * haydovchining keyingi paketigacha — turgan bo'lsa 30 soniyagacha —
 * xaritada umuman ko'rinmasdi.
 */
describe('RealtimeGateway — join:order joylashuv surati', () => {
  const PASSENGER = { id: 'user-pax-1', role: UserRole.PASSENGER, status: UserStatus.ACTIVE };

  let gateway: RealtimeGateway;
  let orderRepository: { findOne: jest.Mock };
  let drivers: { getLastLocationByUserId: jest.Mock };
  let sent: Array<{ event: string; data: unknown }>;

  function client() {
    return {
      id: 'sock-p',
      user: PASSENGER,
      join: jest.fn(async () => undefined),
      emit: (event: string, data: unknown) => sent.push({ event, data }),
    } as never;
  }

  function order(status: OrderStatus, driverId: string | null = 'user-driver-1') {
    return { id: 'ride-1', passengerId: PASSENGER.id, driverId, status };
  }

  beforeEach(() => {
    sent = [];
    orderRepository = { findOne: jest.fn() };
    drivers = { getLastLocationByUserId: jest.fn(async () => ({ lat: 41.03, lng: 70.16 })) };
    gateway = new RealtimeGateway(
      {} as never,
      {} as never,
      drivers as never,
      {} as never,
      {} as never,
      orderRepository as never,
    );
  });

  it.each([OrderStatus.ACCEPTED, OrderStatus.ARRIVED, OrderStatus.IN_PROGRESS])(
    '%s buyurtmada oxirgi joy darhol yuboriladi',
    async (status) => {
      orderRepository.findOne.mockResolvedValue(order(status));

      await gateway.handleJoinOrder(client(), { orderId: 'ride-1' });

      expect(drivers.getLastLocationByUserId).toHaveBeenCalledWith('user-driver-1');
      expect(sent).toEqual([
        {
          event: 'driver:location',
          data: expect.objectContaining({
            lat: 41.03,
            lng: 70.16,
            orderId: 'ride-1',
            driverId: 'user-driver-1',
          }),
        },
      ]);
    },
  );

  // Maxfiylik: safar tugagach yo'lovchi haydovchining qayerdaligini bilmasin.
  it.each([OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.SEARCHING])(
    '%s buyurtmada joylashuv yuborilmaydi',
    async (status) => {
      orderRepository.findOne.mockResolvedValue(order(status));

      await gateway.handleJoinOrder(client(), { orderId: 'ride-1' });

      expect(sent).toEqual([]);
    },
  );

  it('haydovchining joyi hali yo\'q bo\'lsa hech narsa yuborilmaydi', async () => {
    orderRepository.findOne.mockResolvedValue(order(OrderStatus.ACCEPTED));
    drivers.getLastLocationByUserId.mockResolvedValue(null);

    await gateway.handleJoinOrder(client(), { orderId: 'ride-1' });

    expect(sent).toEqual([]);
  });
});
