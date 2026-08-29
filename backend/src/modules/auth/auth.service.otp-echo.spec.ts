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
 * `POST /auth/send-otp` javobida OTP kodi QAYTADIMI.
 *
 * NEGA bu alohida fayl. Jonli serverda bu endpoint yaroqli login kodini
 * javob tanasida qaytarayotgan edi:
 *
 *   {"success":true,"data":{"message":"OTP sent successfully","code":"123456"}}
 *
 * Ya'ni telefon raqamini bilgan har qanday odam — hech qanday
 * autentifikatsiyasiz — istalgan hisobga, jumladan adminga kira olardi.
 *
 * Kodda tekshiruv BOR edi, lekin u `NODE_ENV !== 'production'` ga
 * tayanardi va `NODE_ENV` deploy'da umuman o'rnatilmagandi. Sozlamaning
 * YO'QLIGI eng ochiq holatni bergani — mantiq teskari edi.
 *
 * Endi kodni ko'rsatish uchun `OTP_ECHO_CODE=true` ni ATAYLAB qo'yish
 * kerak: bitta o'zgaruvchining yo'qligi hech narsani ochmaydi.
 */
describe('AuthService — OTP kodini javobda qaytarish', () => {
  let service: AuthService;
  let config: Record<string, string>;

  async function build(overrides: Record<string, string> = {}): Promise<void> {
    config = {
      OTP_BYPASS_ENABLED: 'true',
      OTP_BYPASS_CODE: '123456',
      ...overrides,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(Otp),
          useValue: {
            delete: jest.fn().mockResolvedValue(undefined),
            update: jest.fn().mockResolvedValue(undefined),
            save: jest.fn().mockResolvedValue(undefined),
            findOne: jest.fn(),
          },
        },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: { save: jest.fn(), update: jest.fn(), findOne: jest.fn() },
        },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'token'), verify: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback),
          },
        },
        {
          provide: EskizService,
          useValue: { sendSms: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  }

  it("standart holatda kod QAYTMAYDI", async () => {
    // Eng muhim shart: hech narsa sozlanmagan bo'lsa ham eshik yopiq.
    await build();

    const result = await service.sendOtp('+998901234567');

    expect(result.code).toBeUndefined();
  });

  it("`NODE_ENV` o'rnatilmagan bo'lsa ham kod QAYTMAYDI", async () => {
    // Aynan jonli serverdagi holat: bypass yoqilgan, muhit belgilanmagan.
    // Ilgari shu kombinatsiya kodni javobga chiqarardi.
    await build({ NODE_ENV: undefined as unknown as string });

    const result = await service.sendOtp('+998901234567');

    expect(result.code).toBeUndefined();
  });

  it("`NODE_ENV=development` o'zi YETARLI EMAS", async () => {
    // Muhit nomi endi bu qarorga umuman ta'sir qilmaydi — faqat aniq
    // ruxsat. Aks holda xavf yana bitta o'zgaruvchiga bog'lanib qolardi.
    await build({ NODE_ENV: 'development' });

    const result = await service.sendOtp('+998901234567');

    expect(result.code).toBeUndefined();
  });

  it("faqat `OTP_ECHO_CODE=true` bo'lganda qaytadi", async () => {
    await build({ NODE_ENV: 'development', OTP_ECHO_CODE: 'true' });

    const result = await service.sendOtp('+998901234567');

    expect(result.code).toBe('123456');
  });

  it("bypass o'chiq bo'lsa `OTP_ECHO_CODE` ham kodni ochmaydi", async () => {
    // Bypasssiz kod tasodifiy bo'ladi va SMS orqali ketadi. Uni javobga
    // chiqarish haqiqiy foydalanuvchining kodini oshkor qilardi.
    await build({ OTP_BYPASS_ENABLED: 'false', OTP_ECHO_CODE: 'true' });

    const result = await service.sendOtp('+998901234567');

    expect(result.code).toBeUndefined();
  });

  it("productionda ikkinchi darvozasiz bypass ISHLAMAYDI", async () => {
    // `OTP_BYPASS_ENABLED` o'zi yetarli emas: productionda
    // `ALLOW_OTP_BYPASS_IN_PROD` ham talab qilinadi, ya'ni kod tasodifiy
    // bo'ladi va javobda chiqmaydi.
    await build({ NODE_ENV: 'production', OTP_ECHO_CODE: 'true' });

    const result = await service.sendOtp('+998901234567');

    expect(result.code).toBeUndefined();
  });
});
