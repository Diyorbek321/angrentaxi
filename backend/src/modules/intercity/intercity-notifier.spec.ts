import { IntercityNotifier } from './intercity-notifier';
import type { LocalizedPush } from '../notifications/push-text';

const snapshotRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'trip-1',
  status: 'open',
  seats_taken: 2,
  seats_total: 4,
  whole_car_booked: false,
  departure_at: new Date('2026-10-17T02:00:00.000Z'), // 07:00 Toshkent
  driver_user_id: 'driver-user',
  passenger_ids: ['p1', 'p2'],
  ...overrides,
});

describe('IntercityNotifier', () => {
  let db: { query: jest.Mock };
  let gateway: { emitToUser: jest.Mock; emitToManagers: jest.Mock };
  let notifications: { notifyUserIds: jest.Mock };
  let notifier: IntercityNotifier;

  beforeEach(() => {
    db = { query: jest.fn().mockResolvedValue([snapshotRow()]) };
    gateway = { emitToUser: jest.fn(), emitToManagers: jest.fn() };
    notifications = { notifyUserIds: jest.fn().mockResolvedValue(undefined) };
    // Asserts below read the Uzbek text as (ids, title, body, event, data);
    // the Russian variants are covered in order-notification-texts.spec.ts.
    const service = {
      notifyUserIds: (ids: string[], text: LocalizedPush, event: string, data?: Record<string, string>) => {
        const { title, body } = text('uz');
        return data === undefined
          ? notifications.notifyUserIds(ids, title, body, event)
          : notifications.notifyUserIds(ids, title, body, event, data);
      },
    };
    notifier = new IntercityNotifier(db as never, gateway as never, service as never);
  });

  const emittedTo = (event: string) =>
    gateway.emitToUser.mock.calls.filter((call) => call[1] === event).map((call) => call[0]);

  describe('bookingCreated', () => {
    const event = { tripId: 'trip-1', orderId: 'order-9', seats: 2, bookingKind: 'seat' };

    it("haydovchiga booking:created + push, kuzatuvchilarga trip:updated", async () => {
      await notifier.bookingCreated(event);

      expect(gateway.emitToUser).toHaveBeenCalledWith('driver-user', 'intercity:booking:created', event);
      expect(emittedTo('intercity:trip:updated').sort()).toEqual(['driver-user', 'p1', 'p2']);
      expect(gateway.emitToManagers).toHaveBeenCalledWith('intercity:trip:updated', expect.anything());
      expect(notifications.notifyUserIds).toHaveBeenCalledWith(
        ['driver-user'],
        'Yangi band: 2 joy',
        expect.stringContaining('07:00'),
        'intercity_booking_created',
        { tripId: 'trip-1', orderId: 'order-9' },
      );
    });

    it('butun mashina — alohida matn', async () => {
      await notifier.bookingCreated({ ...event, seats: 4, bookingKind: 'whole_car' });

      expect(notifications.notifyUserIds.mock.calls[0][1]).toBe('Yangi band: butun mashina');
    });
  });

  it('bookingCancelled: haydovchiga booking:cancelled + push', async () => {
    const event = { tripId: 'trip-1', orderId: 'order-9', seats: 1, bookingKind: 'seat' };

    await notifier.bookingCancelled(event);

    expect(gateway.emitToUser).toHaveBeenCalledWith('driver-user', 'intercity:booking:cancelled', event);
    expect(emittedTo('intercity:trip:updated')).toContain('driver-user');
    expect(notifications.notifyUserIds).toHaveBeenCalledWith(
      ['driver-user'],
      'Band bekor qilindi',
      expect.any(String),
      'intercity_booking_cancelled',
      { tripId: 'trip-1', orderId: 'order-9' },
    );
  });

  it("bookingCancelledByDispatcher: yo'lovchiga push (sabab bilan) va trip:cancelled emas", async () => {
    await notifier.bookingCancelledByDispatcher('p9', 'trip-1', 'order-9', "Haydovchi kasal");

    expect(notifications.notifyUserIds).toHaveBeenCalledWith(
      ['p9'],
      'Bandingiz bekor qilindi',
      expect.stringContaining('Haydovchi kasal'),
      'intercity_booking_cancelled_by_dispatcher',
      { tripId: 'trip-1', orderId: 'order-9' },
    );
    expect(emittedTo('intercity:trip:cancelled')).toEqual([]);
  });

  it("boardingStarted: yo'lovchilarga push va trip:updated", async () => {
    db.query.mockResolvedValue([snapshotRow({ status: 'boarding' })]);

    await notifier.boardingStarted('trip-1');

    expect(emittedTo('intercity:trip:updated').sort()).toEqual(['driver-user', 'p1', 'p2']);
    expect(notifications.notifyUserIds).toHaveBeenCalledWith(
      ['p1', 'p2'],
      "Haydovchi yo'lga chiqdi",
      'Haydovchi sizni olishga kelmoqda',
      'intercity_boarding_started',
      { tripId: 'trip-1' },
    );
  });

  it('departed va noShow: faqat trip:updated, push yo\'q', async () => {
    await notifier.departed('trip-1');
    await notifier.noShow('trip-1');

    expect(emittedTo('intercity:trip:updated')).toHaveLength(6);
    expect(notifications.notifyUserIds).not.toHaveBeenCalled();
  });

  describe('tripCancelled', () => {
    it("bandi bekor bo'lgan yo'lovchilarga trip:cancelled + sababli push", async () => {
      db.query.mockResolvedValue([snapshotRow({ status: 'cancelled', passenger_ids: [] })]);

      await notifier.tripCancelled('trip-1', 'Mashina buzildi', ['p1', 'p2'], 'driver');

      expect(emittedTo('intercity:trip:cancelled').sort()).toEqual(['p1', 'p2']);
      expect(gateway.emitToUser).toHaveBeenCalledWith('p1', 'intercity:trip:cancelled', {
        tripId: 'trip-1',
        reason: 'Mashina buzildi',
      });
      expect(notifications.notifyUserIds).toHaveBeenCalledWith(
        ['p1', 'p2'],
        'Qatnov bekor qilindi',
        expect.stringContaining('Mashina buzildi'),
        'intercity_trip_cancelled',
        { tripId: 'trip-1' },
      );
    });

    it("tizim bekor qilganda matn haydovchi sababini aytmaydi", async () => {
      await notifier.tripCancelled('trip-1', 'stale', ['p1'], 'system');

      expect(notifications.notifyUserIds.mock.calls[0][2]).not.toContain('stale');
    });

    it("yo'lovchi bo'lmasa push ham bo'lmaydi", async () => {
      await notifier.tripCancelled('trip-1', 'no_bookings', [], 'system');

      expect(notifications.notifyUserIds).not.toHaveBeenCalled();
      expect(gateway.emitToManagers).toHaveBeenCalled();
    });
  });

  it("departureReminder: haydovchi va yo'lovchilarga alohida matn", async () => {
    await notifier.departureReminder('trip-1');

    expect(notifications.notifyUserIds).toHaveBeenCalledWith(
      ['driver-user'],
      'Qatnovingizga 1 soat qoldi',
      expect.stringContaining('07:00'),
      'intercity_departure_reminder',
      { tripId: 'trip-1' },
    );
    expect(notifications.notifyUserIds).toHaveBeenCalledWith(
      ['p1', 'p2'],
      'Qatnovga 1 soat qoldi',
      expect.stringContaining('07:00'),
      'intercity_departure_reminder',
      { tripId: 'trip-1' },
    );
  });

  describe("xato hech qachon chaqiruvchiga chiqmaydi", () => {
    it('baza yiqilsa', async () => {
      db.query.mockRejectedValue(new Error('db down'));

      await expect(
        notifier.bookingCreated({ tripId: 't', orderId: 'o', seats: 1, bookingKind: 'seat' }),
      ).resolves.toBeUndefined();
      await expect(notifier.tripCancelled('t', 'r', ['p1'], 'driver')).resolves.toBeUndefined();
      await expect(notifier.departureReminder('t')).resolves.toBeUndefined();
    });

    it('push yiqilsa', async () => {
      notifications.notifyUserIds.mockRejectedValue(new Error('fcm down'));

      await expect(notifier.boardingStarted('trip-1')).resolves.toBeUndefined();
    });

    it('socket yiqilsa', async () => {
      gateway.emitToUser.mockImplementation(() => {
        throw new Error('server not ready');
      });

      await expect(notifier.departed('trip-1')).resolves.toBeUndefined();
    });
  });
});
