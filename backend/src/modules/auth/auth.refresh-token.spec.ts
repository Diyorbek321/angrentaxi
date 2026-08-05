import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { IsNull } from 'typeorm';
import { AuthService } from './auth.service';
import { Otp } from '../../database/entities/otp.entity';
import { User, UserRole, UserStatus } from '../../database/entities/user.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { EskizService } from '../notifications/eskiz.service';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

describe('AuthService refresh token rotation', () => {
  let service: AuthService;
  let refreshRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let userRepository: { findOne: jest.Mock; save: jest.Mock };
  let otpRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let jwt: { sign: jest.Mock; verify: jest.Mock };
  let config: Record<string, string | undefined>;
  let signCounter: number;

  const user = {
    id: 'user-1',
    phone: '+998901234567',
    role: UserRole.PASSENGER,
    status: UserStatus.ACTIVE,
  } as User;

  const storedToken = (overrides: Partial<RefreshToken> = {}): RefreshToken =>
    ({
      id: 'rt-1',
      userId: user.id,
      tokenHash: hash('old-refresh'),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      replacedByTokenHash: null,
      userAgent: 'jest',
      ip: '127.0.0.1',
      createdAt: new Date(),
      ...overrides,
    }) as RefreshToken;

  beforeEach(async () => {
    signCounter = 0;
    config = {
      NODE_ENV: 'test',
      APP_SECRET: 'a'.repeat(32),
    };
    // Distinct values per call so rotation (old vs new token) is observable.
    jwt = {
      sign: jest.fn((payload: { type: string }) => {
        signCounter += 1;
        return `${payload.type}-token-${signCounter}`;
      }),
      verify: jest.fn(() => ({
        sub: user.id,
        phone: user.phone,
        role: user.role,
        type: 'refresh',
      })),
    };
    refreshRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    userRepository = {
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn(),
    };
    otpRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Otp), useValue: otpRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepository },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback) },
        },
        { provide: EskizService, useValue: { sendSms: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('returns a new refresh token alongside the access token and revokes the old one', async () => {
    const stored = storedToken();
    refreshRepository.findOne.mockResolvedValue(stored);

    const result = await service.refreshToken('old-refresh');

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.refreshToken).not.toBe('old-refresh');

    // Old row revoked and linked to its successor.
    expect(refreshRepository.update).toHaveBeenCalledWith('rt-1', {
      revokedAt: expect.any(Date),
      replacedByTokenHash: hash(result.refreshToken),
    });

    // New row persisted as a hash, never the token itself.
    const saved = refreshRepository.save.mock.calls[0][0];
    expect(saved.tokenHash).toBe(hash(result.refreshToken));
    expect(JSON.stringify(saved)).not.toContain(result.refreshToken);
    expect(saved.userId).toBe(user.id);
    expect(saved.revokedAt).toBeNull();
  });

  it('carries the session context of the rotated token forward', async () => {
    refreshRepository.findOne.mockResolvedValue(storedToken());

    await service.refreshToken('old-refresh');

    const saved = refreshRepository.save.mock.calls[0][0];
    expect(saved.userAgent).toBe('jest');
    expect(saved.ip).toBe('127.0.0.1');
  });

  it('rejects a refresh token that has no stored row', async () => {
    refreshRepository.findOne.mockResolvedValue(null);

    await expect(service.refreshToken('unknown')).rejects.toThrow(UnauthorizedException);
    expect(refreshRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an expired stored refresh token', async () => {
    refreshRepository.findOne.mockResolvedValue(
      storedToken({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(service.refreshToken('old-refresh')).rejects.toThrow(
      'Invalid or expired refresh token',
    );
    expect(refreshRepository.save).not.toHaveBeenCalled();
  });

  it('revokes every session of the user when an already-revoked token is reused', async () => {
    refreshRepository.findOne.mockResolvedValue(
      storedToken({ revokedAt: new Date(Date.now() - 60_000) }),
    );

    await expect(service.refreshToken('old-refresh')).rejects.toThrow(UnauthorizedException);

    expect(refreshRepository.update).toHaveBeenCalledWith(
      { userId: user.id, revokedAt: IsNull() },
      { revokedAt: expect.any(Date) },
    );
    expect(refreshRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an access token presented as a refresh token', async () => {
    jwt.verify.mockReturnValue({
      sub: user.id,
      phone: user.phone,
      role: user.role,
      type: 'access',
    });

    await expect(service.refreshToken('access-token')).rejects.toThrow(UnauthorizedException);
    expect(refreshRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects a token whose signature does not verify', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    await expect(service.refreshToken('forged')).rejects.toThrow(
      'Invalid or expired refresh token',
    );
  });

  it('still refuses a blocked user', async () => {
    refreshRepository.findOne.mockResolvedValue(storedToken());
    userRepository.findOne.mockResolvedValue({ ...user, status: UserStatus.BLOCKED });

    await expect(service.refreshToken('old-refresh')).rejects.toThrow('Account is blocked');
  });

  it('fails loudly instead of signing with a fallback secret when APP_SECRET is missing', async () => {
    config.APP_SECRET = undefined;

    await expect(service.refreshToken('old-refresh')).rejects.toThrow(/APP_SECRET/);
  });
});

describe('AuthService logout', () => {
  let service: AuthService;
  let refreshRepository: { findOne: jest.Mock; save: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    refreshRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Otp), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepository },
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'x'.repeat(32)) },
        },
        { provide: EskizService, useValue: { sendSms: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('revokes the presented refresh token', async () => {
    refreshRepository.findOne.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      revokedAt: null,
    });

    const result = await service.logout('some-refresh');

    expect(refreshRepository.findOne).toHaveBeenCalledWith({
      where: { tokenHash: hash('some-refresh') },
    });
    expect(refreshRepository.update).toHaveBeenCalledWith('rt-1', {
      revokedAt: expect.any(Date),
    });
    expect(result.message).toMatch(/Logged out/);
  });

  it('makes a subsequent refresh with the logged-out token fail', async () => {
    const revoked = {
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: hash('some-refresh'),
      expiresAt: new Date(Date.now() + 1000),
      revokedAt: new Date(),
    };
    refreshRepository.findOne.mockResolvedValue(revoked);

    await expect(service.refreshToken('some-refresh')).rejects.toThrow(UnauthorizedException);
  });

  it('stays quiet about unknown tokens', async () => {
    refreshRepository.findOne.mockResolvedValue(null);

    await expect(service.logout('never-issued')).resolves.toEqual({
      message: 'Logged out successfully',
    });
    expect(refreshRepository.update).not.toHaveBeenCalled();
  });
});

describe('AuthService token TTL configuration', () => {
  const build = async (config: Record<string, string | undefined>) => {
    const jwt = { sign: jest.fn(() => 'token'), verify: jest.fn() };
    const refreshRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const otpRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'otp-1',
        phone: '+998901234567',
        code: '111111',
        isUsed: false,
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
      }),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Otp), useValue: otpRepository },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 'user-1',
              phone: '+998901234567',
              role: UserRole.PASSENGER,
              status: UserStatus.ACTIVE,
            }),
            save: jest.fn(),
          },
        },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepository },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback) },
        },
        { provide: EskizService, useValue: { sendSms: jest.fn() } },
      ],
    }).compile();

    return {
      service: module.get<AuthService>(AuthService),
      jwt,
      refreshRepository,
    };
  };

  it('keeps the long 7d / 30d defaults while the clients have no refresh flow', async () => {
    const { service, jwt, refreshRepository } = await build({ NODE_ENV: 'test' });

    await service.verifyOtp('+998901234567', '111111');

    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'access' }),
      { expiresIn: '7d' },
    );
    expect(jwt.sign).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'refresh' }),
      { expiresIn: '30d' },
    );

    const saved = refreshRepository.save.mock.calls[0][0];
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(saved.expiresAt.getTime() - Date.now()).toBeGreaterThan(thirtyDays - 5000);
  });

  it('reads shortened lifetimes from JWT_ACCESS_TTL / JWT_REFRESH_TTL', async () => {
    const { service, jwt, refreshRepository } = await build({
      NODE_ENV: 'test',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '2d',
    });

    await service.verifyOtp('+998901234567', '111111');

    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'access' }),
      { expiresIn: '15m' },
    );
    expect(jwt.sign).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'refresh' }),
      { expiresIn: '2d' },
    );

    const saved = refreshRepository.save.mock.calls[0][0];
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    expect(saved.expiresAt.getTime() - Date.now()).toBeGreaterThan(twoDays - 5000);
    expect(saved.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(twoDays);
  });
});
