import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, MAX_OTP_ATTEMPTS } from './auth.service';
import { Otp } from '../../database/entities/otp.entity';
import { User, UserRole, UserStatus } from '../../database/entities/user.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { EskizService } from '../notifications/eskiz.service';

describe('AuthService OTP brute-force protection', () => {
  let service: AuthService;
  let otpRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let userRepository: { findOne: jest.Mock; save: jest.Mock; count: jest.Mock };
  let config: Record<string, string | undefined>;

  const phone = '+998901234567';

  const activeOtp = (overrides: Partial<Otp> = {}): Otp =>
    ({
      id: 'otp-1',
      phone,
      code: '111111',
      isUsed: false,
      attempts: 0,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
      ...overrides,
    }) as Otp;

  beforeEach(async () => {
    config = { OTP_BYPASS_ENABLED: 'false', NODE_ENV: 'test' };
    otpRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    userRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Otp), useValue: otpRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn().mockResolvedValue(undefined),
            update: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'token'), verify: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback) },
        },
        { provide: EskizService, useValue: { sendSms: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('counts a wrong code against the phone\'s active OTP without burning it early', async () => {
    // First findOne (exact code match) misses; second returns the live OTP.
    otpRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(activeOtp({ attempts: 1 }));

    await expect(service.verifyOtp(phone, '999999')).rejects.toThrow(BadRequestException);

    expect(otpRepository.update).toHaveBeenCalledWith('otp-1', {
      attempts: 2,
      isUsed: false,
    });
  });

  it(`burns the OTP on the ${MAX_OTP_ATTEMPTS}th wrong code and says so`, async () => {
    otpRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(activeOtp({ attempts: MAX_OTP_ATTEMPTS - 1 }));

    await expect(service.verifyOtp(phone, '999999')).rejects.toThrow(
      /Too many invalid attempts/,
    );

    expect(otpRepository.update).toHaveBeenCalledWith('otp-1', {
      attempts: MAX_OTP_ATTEMPTS,
      isUsed: true,
    });
  });

  it('rejects the correct code once the OTP has been burned', async () => {
    // A burned OTP has isUsed = true, so the code lookup (which filters on
    // isUsed: false) no longer finds it and no live OTP remains to charge.
    otpRepository.findOne.mockResolvedValue(null);

    await expect(service.verifyOtp(phone, '111111')).rejects.toThrow('Invalid OTP code');
    expect(otpRepository.update).not.toHaveBeenCalled();
  });

  it('does not count attempts when the code is correct', async () => {
    otpRepository.findOne.mockResolvedValueOnce(activeOtp());
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      phone,
      role: UserRole.PASSENGER,
      status: UserStatus.ACTIVE,
    } as User);

    const result = await service.verifyOtp(phone, '111111');

    expect(result.accessToken).toBe('token');
    expect(otpRepository.update).toHaveBeenCalledWith('otp-1', { isUsed: true });
  });
});

describe('AuthService OTP code generation', () => {
  it('generates cryptographically random 6-digit codes', () => {
    const generate = (
      AuthService.prototype as unknown as { generateOtpCode: () => string }
    ).generateOtpCode;

    const codes = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const code = generate.call({});
      expect(code).toMatch(/^\d{6}$/);
      codes.add(code);
    }

    // Sanity check that it is not a constant; collisions are expected but rare.
    expect(codes.size).toBeGreaterThan(150);
  });

  it('does not use Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    const generate = (
      AuthService.prototype as unknown as { generateOtpCode: () => string }
    ).generateOtpCode;

    generate.call({});

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
