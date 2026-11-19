import { NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ACCOUNT_DELETED_REASON, UsersService } from './users.service';
import { User, UserStatus } from '../../database/entities/user.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { FavoriteAddress } from '../../database/entities/favorite-address.entity';
import { Driver } from '../../database/entities/driver.entity';

describe('UsersService.deleteAccount', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  let userRepository: { findOne: jest.Mock };
  let manager: { update: jest.Mock; delete: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    userRepository = { findOne: jest.fn().mockResolvedValue({ id: userId, phone: '+998901234567' }) };
    manager = { update: jest.fn().mockResolvedValue(undefined), delete: jest.fn().mockResolvedValue(undefined) };
    const dataSource = { transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)) };
    service = new UsersService(userRepository as never, dataSource as never);
  });

  it('wipes personal data, releases the phone and blocks the account', async () => {
    await service.deleteAccount(userId);
    expect(manager.update).toHaveBeenCalledWith(User, userId, expect.objectContaining({
      phone: `deleted:${userId}`,
      firstName: null,
      lastName: null,
      fcmToken: null,
      status: UserStatus.BLOCKED,
      blockReason: ACCOUNT_DELETED_REASON,
    }));
  });

  it('revokes every live session and removes saved addresses', async () => {
    await service.deleteAccount(userId);
    expect(manager.update).toHaveBeenCalledWith(
      RefreshToken,
      { userId, revokedAt: IsNull() },
      { revokedAt: expect.any(Date) },
    );
    expect(manager.delete).toHaveBeenCalledWith(FavoriteAddress, { userId });
    expect(manager.update).toHaveBeenCalledWith(Driver, { userId }, { isOnline: false });
  });

  it('throws when the user does not exist', async () => {
    userRepository.findOne.mockResolvedValue(null);
    await expect(service.deleteAccount(userId)).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.update).not.toHaveBeenCalled();
  });
});
