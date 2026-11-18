import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';
import { User, UserRole, UserStatus } from '../../database/entities/user.entity';

/**
 * Access tokens are long-lived (7 days), and blocking used to be enforced only
 * at login and refresh time — so an admin blocking a fraudulent driver left
 * that driver fully operational until the token expired. `validate()` now
 * rejects BLOCKED accounts on every authenticated request.
 */
describe('JwtStrategy.validate', () => {
  let strategy: JwtStrategy;
  let usersService: { findById: jest.Mock; updateLanguage: jest.Mock };

  const payload = {
    sub: 'user-1',
    phone: '+998900000000',
    role: 'driver',
    type: 'access' as const,
  };
  const req = (acceptLanguage?: string) =>
    ({ headers: acceptLanguage ? { 'accept-language': acceptLanguage } : {} }) as unknown as Request;

  let env: Record<string, string | undefined>;

  beforeEach(() => {
    env = {};
    usersService = { findById: jest.fn(), updateLanguage: jest.fn().mockResolvedValue(undefined) };
    // getOrThrow, not get: the strategy must not fall back to a default secret.
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
      get: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService;
    strategy = new JwtStrategy(configService, usersService as unknown as UsersService);
  });

  it('rejects a blocked user with UnauthorizedException', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      status: UserStatus.BLOCKED,
    });

    await expect(strategy.validate(req(), payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts an active user', async () => {
    const user = { id: 'user-1', status: UserStatus.ACTIVE } as User;
    usersService.findById.mockResolvedValue(user);

    // Nusxa qaytadi (`withSessionRole`), asl obyekt emas.
    await expect(strategy.validate(req(), payload)).resolves.toMatchObject(user);
  });

  it('rejects refresh tokens', async () => {
    await expect(
      strategy.validate(req(), { ...payload, type: 'refresh' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('rejects an unknown user', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(strategy.validate(req(), payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('language sync (Accept-Language)', () => {
    const active = (language: 'uz' | 'ru') =>
      ({ id: 'user-1', status: UserStatus.ACTIVE, language }) as User;

    it('stores the app language when it changed', async () => {
      const user = active('uz');
      usersService.findById.mockResolvedValue(user);

      const result = await strategy.validate(req('ru'), payload);

      expect(usersService.updateLanguage).toHaveBeenCalledWith('user-1', 'ru');
      expect(result.language).toBe('ru');
    });

    it('does not write when the language is unchanged', async () => {
      usersService.findById.mockResolvedValue(active('ru'));

      await strategy.validate(req('ru'), payload);

      expect(usersService.updateLanguage).not.toHaveBeenCalled();
    });

    it("ignores a browser's default header — it is not a user choice", async () => {
      usersService.findById.mockResolvedValue(active('uz'));

      await strategy.validate(req('ru-RU,ru;q=0.9,en;q=0.8'), payload);

      expect(usersService.updateLanguage).not.toHaveBeenCalled();
    });

    it('still authenticates when the language update fails', async () => {
      const user = active('uz');
      usersService.findById.mockResolvedValue(user);
      usersService.updateLanguage.mockRejectedValue(new Error('db down'));

      await expect(strategy.validate(req('ru'), payload)).resolves.toMatchObject({ id: 'user-1' });
    });
  });

  describe("faol rol (bitta raqam bilan ikkala ilova)", () => {
    const driver = () => ({ id: 'user-1', status: UserStatus.ACTIVE, role: UserRole.DRIVER }) as User;

    it("yo'lovchi ilovasi tokeni bilan haydovchi — role passenger, accountRole driver", async () => {
      usersService.findById.mockResolvedValue(driver());

      const result = await strategy.validate(req(), { ...payload, app: 'passenger' });

      expect(result.role).toBe(UserRole.PASSENGER);
      expect(result.accountRole).toBe(UserRole.DRIVER);
    });

    it('driver ilovasi yoki eski token — driver', async () => {
      usersService.findById.mockResolvedValue(driver());
      await expect(strategy.validate(req(), { ...payload, app: 'driver' })).resolves.toMatchObject({
        role: UserRole.DRIVER,
      });
      await expect(strategy.validate(req(), payload)).resolves.toMatchObject({ role: UserRole.DRIVER });
    });

    it('B reja: flag o\'chiq — yo\'lovchi ilovasida ham driver', async () => {
      env.DUAL_ROLE_LOGIN_ENABLED = 'false';
      usersService.findById.mockResolvedValue(driver());
      await expect(strategy.validate(req(), { ...payload, app: 'passenger' })).resolves.toMatchObject({
        role: UserRole.DRIVER,
      });
    });

    it('rol tokendan emas, bazadan: tokenda "admin" yozilgan bo\'lsa ham passenger qoladi', async () => {
      usersService.findById.mockResolvedValue({ id: 'user-1', status: UserStatus.ACTIVE, role: UserRole.PASSENGER } as User);
      await expect(strategy.validate(req(), { ...payload, role: 'admin', app: 'driver' })).resolves.toMatchObject({
        role: UserRole.PASSENGER,
      });
    });
  });
});
