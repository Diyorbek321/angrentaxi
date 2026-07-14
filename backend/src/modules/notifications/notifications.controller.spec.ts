import { NotFoundException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { UsersService } from '../users/users.service';
import { NotificationsService } from './notifications.service';
import { User, UserRole } from '../../database/entities/user.entity';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let usersService: { updateFcmToken: jest.Mock };
  let notificationsService: {
    listForUser: jest.Mock;
    markRead: jest.Mock;
    markAllRead: jest.Mock;
  };

  const user = { id: 'user-1', role: UserRole.PASSENGER } as User;
  const otherUser = { id: 'user-2', role: UserRole.PASSENGER } as User;

  beforeEach(() => {
    usersService = { updateFcmToken: jest.fn().mockResolvedValue(undefined) };
    notificationsService = {
      listForUser: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };
    controller = new NotificationsController(
      usersService as unknown as UsersService,
      notificationsService as unknown as NotificationsService,
    );
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

  describe('GET /notifications', () => {
    it("delegates to the service scoped to the caller's own id", async () => {
      const rows = [{ id: 'log-1', userId: 'user-1' }];
      notificationsService.listForUser.mockResolvedValue(rows);

      const result = await controller.list(user);

      expect(notificationsService.listForUser).toHaveBeenCalledWith('user-1');
      expect(result).toBe(rows);
    });

    it("never leaks another user's rows — only the authenticated user's id is ever passed through", async () => {
      notificationsService.listForUser.mockResolvedValue([]);

      await controller.list(otherUser);

      expect(notificationsService.listForUser).toHaveBeenCalledWith('user-2');
      expect(notificationsService.listForUser).not.toHaveBeenCalledWith('user-1');
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('marks the given notification read for the authenticated user', async () => {
      const updated = { id: 'log-1', userId: 'user-1', read: true };
      notificationsService.markRead.mockResolvedValue(updated);

      const result = await controller.markRead('log-1', user);

      expect(notificationsService.markRead).toHaveBeenCalledWith('log-1', 'user-1');
      expect(result).toBe(updated);
    });

    it("propagates 404 when the notification does not belong to the caller", async () => {
      notificationsService.markRead.mockRejectedValue(
        new NotFoundException('Notification log-1 not found'),
      );

      await expect(controller.markRead('log-1', otherUser)).rejects.toThrow(NotFoundException);
      expect(notificationsService.markRead).toHaveBeenCalledWith('log-1', 'user-2');
    });
  });

  describe('POST /notifications/read-all', () => {
    it("marks all of the caller's unread notifications as read", async () => {
      notificationsService.markAllRead.mockResolvedValue({ updated: 4 });

      const result = await controller.markAllRead(user);

      expect(notificationsService.markAllRead).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ updated: 4 });
    });
  });
});
