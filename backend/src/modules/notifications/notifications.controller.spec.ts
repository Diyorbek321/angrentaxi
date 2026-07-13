import { NotificationsController } from './notifications.controller';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../../database/entities/user.entity';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let usersService: { updateFcmToken: jest.Mock };

  const user = { id: 'user-1', role: UserRole.PASSENGER } as User;

  beforeEach(() => {
    usersService = { updateFcmToken: jest.fn().mockResolvedValue(undefined) };
    controller = new NotificationsController(usersService as unknown as UsersService);
  });

  it('stores the FCM token against the authenticated user', async () => {
    await controller.registerToken(user, { token: 'a-real-looking-fcm-token' });

    expect(usersService.updateFcmToken).toHaveBeenCalledWith(
      'user-1',
      'a-real-looking-fcm-token',
    );
  });

  it('ignores the optional platform/role fields — only the token is persisted', async () => {
    await controller.registerToken(user, {
      token: 'another-fcm-token',
      platform: 'android',
      role: 'driver',
    });

    expect(usersService.updateFcmToken).toHaveBeenCalledWith(
      'user-1',
      'another-fcm-token',
    );
  });
});
