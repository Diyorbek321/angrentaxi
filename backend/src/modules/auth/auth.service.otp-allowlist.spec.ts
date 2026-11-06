import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { EskizService } from '../notifications/eskiz.service';
import { Otp } from '../../database/entities/otp.entity';
import { User } from '../../database/entities/user.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';

/**
 * Sinov raqamlari ro'yxati (`OTP_BYPASS_PHONES`).
 *
 * NEGA. Yopiq sinov SMS provayderi (Eskiz) ulanmasdan boshlanadi. Hammaga
 * ochiq bypass (`OTP_BYPASS_ENABLED` + `ALLOW_OTP_BYPASS_IN_PROD`) jonli
 * serverda istalgan raqamni — adminni ham — bitta kod bilan ochadi. Ro'yxat
 * esa eshikni faqat sanab o'tilgan raqamlar uchun ochadi.
 *
 * Qoidalar:
 *   - ro'yxatdagi raqam → belgilangan kod saqlanadi, SMS yuborilmaydi;
 *   - ro'yxatda YO'Q raqam → tasodifiy kod + SMS (bypass ishlamaydi);
 *   - `OTP_BYPASS_CODE` ATAYLAB berilmagan bo'lsa ro'yxat e'tiborga olinmaydi
 *     (hamma biladigan `123456` standartiga tushib qolmasin);
 *   - kod javobda faqat `OTP_ECHO_CODE=true` bo'lsa qaytadi (o'zgarmagan).
 */
describe('AuthService — OTP sinov raqamlari ro\'yxati', () => {
  let service: AuthService;
  let otpRepo: { save: jest.Mock; delete: jest.Mock; update: jest.Mock; findOne: jest.Mock };
  let eskiz: { sendSms: jest.Mock };

  async function build(config: Record<string, unknown>): Promise<void> {
    otpRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
    };
    eskiz = { sendSms: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Otp), useValue: otpRepo },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: { save: jest.fn(), update: jest.fn(), findOne: jest.fn() },
        },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'token'), verify: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback) },
        },
        { provide: EskizService, useValue: eskiz },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  }

  const prod = {
    NODE_ENV: 'production',
    OTP_BYPASS_PHONES: '+998901111111, +998902222222',
    OTP_BYPASS_CODE: '481516',
  };

  it("productionda ro'yxatdagi raqam belgilangan kodni oladi, SMS ketmaydi", async () => {
    await build(prod);

    await service.sendOtp('+998902222222');

    expect(otpRepo.save).toHaveBeenCalledWith(expect.objectContaining({ code: '481516' }));
    expect(eskiz.sendSms).not.toHaveBeenCalled();
  });

  it("ro'yxatda yo'q raqam uchun bypass ishlamaydi — tasodifiy kod va SMS", async () => {
    await build(prod);

    await service.sendOtp('+998903333333');

    const saved = otpRepo.save.mock.calls[0][0] as { code: string };
    expect(saved.code).not.toBe('481516');
    expect(saved.code).toMatch(/^\d{6}$/);
    expect(eskiz.sendSms).toHaveBeenCalledTimes(1);
  });

  it("OTP_BYPASS_CODE berilmasa ro'yxat e'tiborga olinmaydi (123456 ga tushmaydi)", async () => {
    await build({ NODE_ENV: 'production', OTP_BYPASS_PHONES: '+998901111111' });

    await service.sendOtp('+998901111111');

    const saved = otpRepo.save.mock.calls[0][0] as { code: string };
    expect(saved.code).not.toBe('123456');
    expect(eskiz.sendSms).toHaveBeenCalledTimes(1);
  });

  it("ro'yxat bo'yicha kirishda kod javobda QAYTMAYDI", async () => {
    await build(prod);

    const result = await service.sendOtp('+998901111111');

    expect(result.code).toBeUndefined();
  });

  it("bo'sh yoki buzuq ro'yxat hech kimni ochmaydi", async () => {
    await build({ NODE_ENV: 'production', OTP_BYPASS_PHONES: ' , ,', OTP_BYPASS_CODE: '481516' });

    await service.sendOtp('+998901111111');

    expect(eskiz.sendSms).toHaveBeenCalledTimes(1);
  });
});
