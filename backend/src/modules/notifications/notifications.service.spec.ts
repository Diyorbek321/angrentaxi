import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { FirebaseService } from './firebase.service';
import { EskizService } from './eskiz.service';
import { NotificationLog } from '../../database/entities/notification-log.entity';
import { User, UserRole } from '../../database/entities/user.entity';
import { Driver } from '../../database/entities/driver.entity';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { PushNotificationLog } from '../../database/entities/push-notification-log.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;

  let notificationLogRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let firebaseService: { sendPush: jest.Mock };
  let eskizService: { sendSms: jest.Mock };

  const baseUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 'user-1',
      role: UserRole.PASSENGER,
      fcmToken: 'a-real-looking-fcm-token',
      firstName: 'Jasur',
      lastName: 'Rahimov',
      ...overrides,
    }) as User;

  const baseOrder = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'order-1',
      pickupAddress: 'Amir Temur 1',
      dropoffAddress: 'Mustaqillik 5',
      estimatedPrice: 15000,
      status: OrderStatus.IN_PROGRESS,
      ...overrides,
    }) as Order;

  const baseDriver = (overrides: Partial<Driver> = {}): Driver =>
    ({
      id: 'driver-1',
      user: baseUser({ id: 'driver-user-1', firstName: 'Ali', lastName: 'Valiyev' }),
      ...overrides,
    }) as Driver;

  beforeEach(async () => {
    notificationLogRepository = {
      create: jest.fn((data) => ({ id: 'log-1', read: false, ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    firebaseService = { sendPush: jest.fn().mockResolvedValue(undefined) };
    eskizService = { sendSms: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: FirebaseService, useValue: firebaseService },
        { provide: EskizService, useValue: eskizService },
        {
          provide: getRepositoryToken(NotificationLog),
          useValue: notificationLogRepository,
        },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(PushNotificationLog), useValue: {} },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('notify* persistence', () => {
    it('notifyOrderAccepted persists a log row even when the passenger has no fcmToken', async () => {
      const passenger = baseUser({ fcmToken: null });
      const driver = baseDriver();
      const order = baseOrder();

      await service.notifyOrderAccepted(passenger, driver, order);

      expect(firebaseService.sendPush).not.toHaveBeenCalled();
      expect(notificationLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', event: 'order_accepted' }),
      );
      expect(notificationLogRepository.save).toHaveBeenCalled();
    });

    it('notifyDriverArrived persists a log row even when the passenger has no fcmToken', async () => {
      const passenger = baseUser({ fcmToken: null });

      await service.notifyDriverArrived(passenger, baseOrder());

      expect(firebaseService.sendPush).not.toHaveBeenCalled();
      expect(notificationLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', event: 'driver_arrived' }),
      );
    });

    it('notifyTripCompleted persists a log row even when the passenger has no fcmToken', async () => {
      const passenger = baseUser({ fcmToken: null });

      await service.notifyTripCompleted(passenger, 25000, baseOrder());

      expect(firebaseService.sendPush).not.toHaveBeenCalled();
      expect(notificationLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', event: 'trip_completed' }),
      );
    });

    it('notifyNewOrderOffer persists a log row even when the driver has no fcmToken', async () => {
      const driver = baseUser({ id: 'driver-user-1', fcmToken: null });

      await service.notifyNewOrderOffer(driver, baseOrder());

      expect(firebaseService.sendPush).not.toHaveBeenCalled();
      expect(notificationLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'driver-user-1', event: 'new_order_offer' }),
      );
    });

    it('notifyOrderCancelled persists a log row even when the target user has no fcmToken', async () => {
      const targetUser = baseUser({ fcmToken: null });

      await service.notifyOrderCancelled(targetUser, baseOrder(), 'no drivers available');

      expect(firebaseService.sendPush).not.toHaveBeenCalled();
      expect(notificationLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', event: 'order_cancelled' }),
      );
    });

    it('notifySupportReply persists a log row even when the recipient has no fcmToken', async () => {
      const recipient = baseUser({ fcmToken: null });

      await service.notifySupportReply(recipient);

      expect(firebaseService.sendPush).not.toHaveBeenCalled();
      expect(notificationLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', event: 'support_reply' }),
      );
    });

    it('still sends the push AND persists the log row when fcmToken is present', async () => {
      const passenger = baseUser();

      await service.notifyDriverArrived(passenger, baseOrder());

      expect(firebaseService.sendPush).toHaveBeenCalledWith(
        'a-real-looking-fcm-token',
        'Driver Arrived',
        'Your driver has arrived at the pickup location',
        expect.objectContaining({ event: 'driver_arrived' }),
      );
      expect(notificationLogRepository.save).toHaveBeenCalled();
    });

    it('does not throw when persisting the log row fails — push path is unaffected', async () => {
      notificationLogRepository.save.mockRejectedValueOnce(new Error('db is down'));
      const passenger = baseUser();

      await expect(service.notifyDriverArrived(passenger, baseOrder())).resolves.toBeUndefined();
      expect(firebaseService.sendPush).toHaveBeenCalled();
    });
  });

  describe('listForUser', () => {
    it('queries scoped to the given userId only, newest first, capped at 50', async () => {
      const rows = [{ id: 'log-2' }, { id: 'log-1' }];
      notificationLogRepository.find.mockResolvedValue(rows);

      const result = await service.listForUser('user-1');

      expect(notificationLogRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        take: 50,
      });
      expect(result).toEqual(rows);
    });
  });

  describe('markRead', () => {
    it('marks the row read when it exists and belongs to the caller', async () => {
      const log = { id: 'log-1', userId: 'user-1', read: false } as NotificationLog;
      notificationLogRepository.findOne.mockResolvedValue(log);

      const result = await service.markRead('log-1', 'user-1');

      expect(notificationLogRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'log-1', userId: 'user-1' },
      });
      expect(result.read).toBe(true);
      expect(notificationLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'log-1', read: true }),
      );
    });

    it('throws NotFoundException when the row does not exist for this user (including when it belongs to someone else)', async () => {
      notificationLogRepository.findOne.mockResolvedValue(null);

      await expect(service.markRead('log-1', 'someone-elses-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(notificationLogRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('updates all unread rows for the caller and returns the affected count', async () => {
      notificationLogRepository.update.mockResolvedValue({ affected: 3 });

      const result = await service.markAllRead('user-1');

      expect(notificationLogRepository.update).toHaveBeenCalledWith(
        { userId: 'user-1', read: false },
        { read: true },
      );
      expect(result).toEqual({ updated: 3 });
    });

    it('returns 0 when there was nothing to update', async () => {
      notificationLogRepository.update.mockResolvedValue({ affected: undefined });

      const result = await service.markAllRead('user-1');

      expect(result).toEqual({ updated: 0 });
    });
  });
});
