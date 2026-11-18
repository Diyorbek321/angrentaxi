import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Otp } from '../../database/entities/otp.entity';
import { User, UserRole, UserStatus } from '../../database/entities/user.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { EskizService } from '../notifications/eskiz.service';

/** Bitta raqam bilan ikkala ilovaga kirish — `session-role.ts`. */
describe('AuthService — faol rol (ilovaga qarab)', () => {
  let service: AuthService;
  let jwtSign: jest.Mock;
  let jwtVerify: jest.Mock;
  let refreshRepo: { findOne: jest.Mock; save: jest.Mock; update: jest.Mock };
  let userRepository: { findOne: jest.Mock; save: jest.Mock };
  let config: Record<string, string | undefined>;

  const phone = '+998901234567';

  const driverUser = (): User =>
    Object.assign(new User(), {
      id: 'drv-1',
      phone,
      role: UserRole.DRIVER,
      status: UserStatus.ACTIVE,
    });

  beforeEach(async () => {
    config = { NODE_ENV: 'test' };
    jwtSign = jest.fn((payload: { type: string }) => `${payload.type}-token`);
    jwtVerify = jest.fn();
    refreshRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    userRepository = { findOne: jest.fn().mockResolvedValue(driverUser()), save: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(Otp),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 'otp-1',
              phone,
              code: '111111',
              isUsed: false,
              attempts: 0,
              expiresAt: new Date(Date.now() + 60_000),
            }),
            update: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepo },
        { provide: JwtService, useValue: { sign: jwtSign, verify: jwtVerify } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'APP_SECRET' ? 'secret' : config[key])) },
        },
        { provide: EskizService, useValue: { sendSms: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  const signedPayloads = (): Array<Record<string, unknown>> =>
    jwtSign.mock.calls.map((c) => c[0] as Record<string, unknown>);

  it("haydovchi yo'lovchi ilovasidan — sessiya roli passenger, tokenda app", async () => {
    const result = await service.verifyOtp(phone, '111111', {}, 'passenger');

    expect(result.user.role).toBe(UserRole.PASSENGER);
    expect(result.user.accountRole).toBe(UserRole.DRIVER);
    for (const p of signedPayloads()) {
      expect(p).toMatchObject({ sub: 'drv-1', role: UserRole.PASSENGER, app: 'passenger' });
    }
    // Bazaga rol YOZILMAYDI.
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('haydovchi driver ilovasidan — driver', async () => {
    const result = await service.verifyOtp(phone, '111111', {}, 'driver');
    expect(result.user.role).toBe(UserRole.DRIVER);
    expect(signedPayloads()[0]).toMatchObject({ role: UserRole.DRIVER, app: 'driver' });
  });

  it("eski ilova (app yo'q) — bazadagi rol, tokenda app yo'q", async () => {
    const result = await service.verifyOtp(phone, '111111', {});
    expect(result.user.role).toBe(UserRole.DRIVER);
    expect(signedPayloads()[0]).not.toHaveProperty('app');
  });

  it("B reja: DUAL_ROLE_LOGIN_ENABLED=false — haydovchi yo'lovchi ilovasida ham driver", async () => {
    config.DUAL_ROLE_LOGIN_ENABLED = 'false';
    const result = await service.verifyOtp(phone, '111111', {}, 'passenger');
    expect(result.user.role).toBe(UserRole.DRIVER);
  });

  it('refresh — eski tokendagi app yangi juftlikka o\'tadi', async () => {
    jwtVerify.mockReturnValue({ sub: 'drv-1', phone, role: 'passenger', type: 'refresh', app: 'passenger' });
    refreshRepo.findOne.mockResolvedValue({
      id: 'rt-1',
      userId: 'drv-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: null,
      ip: null,
    });

    await service.refreshToken('old-refresh');

    for (const p of signedPayloads()) {
      expect(p).toMatchObject({ role: UserRole.PASSENGER, app: 'passenger' });
    }
  });

  it("refresh — tokendagi noma'lum app e'tiborsiz (imtiyoz bermaydi)", async () => {
    jwtVerify.mockReturnValue({ sub: 'drv-1', phone, role: 'driver', type: 'refresh', app: 'admin' });
    refreshRepo.findOne.mockResolvedValue({
      id: 'rt-1',
      userId: 'drv-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: null,
      ip: null,
    });

    await service.refreshToken('old-refresh');

    expect(signedPayloads()[0]).not.toHaveProperty('app');
    expect(signedPayloads()[0]).toMatchObject({ role: UserRole.DRIVER });
  });
});
