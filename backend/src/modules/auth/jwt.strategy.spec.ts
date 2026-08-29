import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';
import { User, UserStatus } from '../../database/entities/user.entity';

/**
 * Access tokens are long-lived (7 days), and blocking used to be enforced only
 * at login and refresh time — so an admin blocking a fraudulent driver left
 * that driver fully operational until the token expired. `validate()` now
 * rejects BLOCKED accounts on every authenticated request.
 */
describe('JwtStrategy.validate', () => {
  let strategy: JwtStrategy;
  let usersService: { findById: jest.Mock };

  const payload = {
    sub: 'user-1',
    phone: '+998900000000',
    role: 'driver',
    type: 'access' as const,
  };

  beforeEach(() => {
    usersService = { findById: jest.fn() };
    // getOrThrow, not get: the strategy must not fall back to a default secret.
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;
    strategy = new JwtStrategy(configService, usersService as unknown as UsersService);
  });

  it('rejects a blocked user with UnauthorizedException', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      status: UserStatus.BLOCKED,
    });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts an active user', async () => {
    const user = { id: 'user-1', status: UserStatus.ACTIVE } as User;
    usersService.findById.mockResolvedValue(user);

    await expect(strategy.validate(payload)).resolves.toBe(user);
  });

  it('rejects refresh tokens', async () => {
    await expect(
      strategy.validate({ ...payload, type: 'refresh' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('rejects an unknown user', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
