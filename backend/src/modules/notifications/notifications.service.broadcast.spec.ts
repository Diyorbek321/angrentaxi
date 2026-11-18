import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { FirebaseService } from './firebase.service';
import { EskizService } from './eskiz.service';
import { NotificationLog } from '../../database/entities/notification-log.entity';
import { User, UserRole } from '../../database/entities/user.entity';
import {
  BroadcastAudience,
  PushNotificationLog,
} from '../../database/entities/push-notification-log.entity';

describe('NotificationsService.broadcast (uz/ru)', () => {
  let service: NotificationsService;
  let firebaseService: { sendPush: jest.Mock };
  let pushLogRepository: { create: jest.Mock; save: jest.Mock };
  let recipients: Partial<User>[];

  beforeEach(async () => {
    recipients = [
      { id: 'u-uz', role: UserRole.PASSENGER, fcmToken: 'tok-uz', language: 'uz' },
      { id: 'u-ru', role: UserRole.PASSENGER, fcmToken: 'tok-ru', language: 'ru' },
      { id: 'u-null', role: UserRole.DRIVER, fcmToken: 'tok-null', language: undefined },
    ];
    firebaseService = { sendPush: jest.fn().mockResolvedValue(undefined) };
    pushLogRepository = {
      create: jest.fn((data) => ({ id: 'b-1', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(() => Promise.resolve(recipients)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: FirebaseService, useValue: firebaseService },
        { provide: EskizService, useValue: {} },
        { provide: getRepositoryToken(NotificationLog), useValue: {} },
        { provide: getRepositoryToken(User), useValue: { createQueryBuilder: () => qb } },
        { provide: getRepositoryToken(PushNotificationLog), useValue: pushLogRepository },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  it("sends each user the text in their own language", async () => {
    await service.broadcast(
      { title: 'Salom', body: 'Chegirma', titleRu: 'Привет', bodyRu: 'Скидка' },
      BroadcastAudience.ALL,
      'admin-1',
    );

    expect(firebaseService.sendPush).toHaveBeenCalledWith('tok-uz', 'Salom', 'Chegirma');
    expect(firebaseService.sendPush).toHaveBeenCalledWith('tok-ru', 'Привет', 'Скидка');
    expect(firebaseService.sendPush).toHaveBeenCalledWith('tok-null', 'Salom', 'Chegirma');
  });

  it('falls back to the Uzbek text for Russian users when no Russian text is given', async () => {
    await service.broadcast({ title: 'Salom', body: 'Chegirma' }, BroadcastAudience.ALL, 'admin-1');

    expect(firebaseService.sendPush).toHaveBeenCalledWith('tok-ru', 'Salom', 'Chegirma');
  });

  it('ignores a half-written Russian text instead of mixing languages', async () => {
    const log = await service.broadcast(
      { title: 'Salom', body: 'Chegirma', titleRu: 'Привет', bodyRu: '  ' },
      BroadcastAudience.ALL,
      'admin-1',
    );

    expect(firebaseService.sendPush).toHaveBeenCalledWith('tok-ru', 'Salom', 'Chegirma');
    expect(log).toEqual(expect.objectContaining({ titleRu: null, bodyRu: null }));
  });

  it('persists both language versions in the history row', async () => {
    const log = await service.broadcast(
      { title: 'Salom', body: 'Chegirma', titleRu: 'Привет', bodyRu: 'Скидка' },
      BroadcastAudience.CUSTOMERS,
      'admin-1',
    );

    expect(log).toEqual(
      expect.objectContaining({
        title: 'Salom',
        body: 'Chegirma',
        titleRu: 'Привет',
        bodyRu: 'Скидка',
        sentCount: 3,
        createdByUserId: 'admin-1',
      }),
    );
  });

  it('stores null Russian fields when only Uzbek was written', async () => {
    const log = await service.broadcast({ title: 'Salom', body: 'Chegirma' }, BroadcastAudience.ALL, 'a');

    expect(log).toEqual(expect.objectContaining({ titleRu: null, bodyRu: null }));
  });

  it('keeps going when one token fails and counts only successes', async () => {
    firebaseService.sendPush.mockRejectedValueOnce(new Error('expired'));

    const log = await service.broadcast({ title: 'Salom', body: 'Chegirma' }, BroadcastAudience.ALL, 'a');

    expect(firebaseService.sendPush).toHaveBeenCalledTimes(3);
    expect(log.sentCount).toBe(2);
  });
});
