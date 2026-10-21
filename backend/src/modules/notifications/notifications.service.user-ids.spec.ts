import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { FirebaseService } from './firebase.service';
import { EskizService } from './eskiz.service';
import { NotificationLog } from '../../database/entities/notification-log.entity';
import { User } from '../../database/entities/user.entity';
import { PushNotificationLog } from '../../database/entities/push-notification-log.entity';
import { localized } from './push-text';

describe('NotificationsService.notifyUserIds', () => {
  let service: NotificationsService;
  let firebaseService: { sendPush: jest.Mock };
  let userRepository: { find: jest.Mock };
  let logRepository: { create: jest.Mock; save: jest.Mock };

  const TEXT = localized({
    uz: { title: 'Sarlavha', body: 'Matn' },
    ru: { title: 'Заголовок', body: 'Текст' },
  });

  beforeEach(async () => {
    firebaseService = { sendPush: jest.fn().mockResolvedValue(undefined) };
    userRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 'u1', fcmToken: 'token-1' },
        { id: 'u2', fcmToken: null },
        { id: 'u3', fcmToken: 'token-3', language: 'ru' },
      ]),
    };
    logRepository = {
      create: jest.fn((data) => data),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: FirebaseService, useValue: firebaseService },
        { provide: EskizService, useValue: {} },
        { provide: getRepositoryToken(NotificationLog), useValue: logRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(PushNotificationLog), useValue: {} },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  it('har bir tokenli foydalanuvchiga push, hammasiga tarix yozuvi', async () => {
    await service.notifyUserIds(['u1', 'u2', 'u3'], TEXT, 'intercity_test', { tripId: 't1' });

    expect(firebaseService.sendPush).toHaveBeenCalledTimes(2);
    expect(firebaseService.sendPush).toHaveBeenCalledWith('token-1', 'Sarlavha', 'Matn', {
      event: 'intercity_test',
      tripId: 't1',
    });
    expect(logRepository.save).toHaveBeenCalledTimes(3);
  });

  it("har kim o'z tilida oladi — push ham, tarix yozuvi ham", async () => {
    await service.notifyUserIds(['u1', 'u3'], TEXT, 'intercity_test');

    expect(firebaseService.sendPush).toHaveBeenCalledWith('token-1', 'Sarlavha', 'Matn', { event: 'intercity_test' });
    expect(firebaseService.sendPush).toHaveBeenCalledWith('token-3', 'Заголовок', 'Текст', { event: 'intercity_test' });
    expect(logRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u3', title: 'Заголовок', body: 'Текст' }),
    );
  });

  it("bitta push yiqilsa qolganlari baribir yuboriladi va xato tashqariga chiqmaydi", async () => {
    firebaseService.sendPush.mockRejectedValueOnce(new Error('expired token'));

    await expect(service.notifyUserIds(['u1', 'u3'], TEXT, 'e')).resolves.toBeUndefined();

    expect(firebaseService.sendPush).toHaveBeenCalledTimes(2);
  });

  it("bo'sh ro'yxatda bazaga ham murojaat qilinmaydi", async () => {
    await service.notifyUserIds([], TEXT, 'e');

    expect(userRepository.find).not.toHaveBeenCalled();
  });

  it('takroriy id lar bitta push oladi', async () => {
    await service.notifyUserIds(['u1', 'u1'], TEXT, 'e');

    const where = userRepository.find.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('u1');
    expect(JSON.stringify(where).match(/u1/g)).toHaveLength(1);
  });
});
