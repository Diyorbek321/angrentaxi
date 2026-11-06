import { Transform, plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  validateSync,
  Matches,
  Min,
  MinLength,
  Max,
} from 'class-validator';
import {
  DEFAULT_ACCESS_TTL,
  DEFAULT_REFRESH_TTL,
} from '../modules/auth/token-ttl.util';
import { envBoolean } from '../common/utils/env-boolean.util';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  /**
   * MAJBURIY — standart qiymati ATAYLAB yo'q.
   *
   * ⚠️ NEGA. Ilgari bu yerda `= Environment.Development` turardi, ya'ni
   * o'zgaruvchini o'rnatishni unutgan deploy JIMGINA dev serverga aylanardi.
   * Jonli serverda aynan shu holat kuzatildi va u bir vaqtning o'zida
   * beshta xatti-harakatni ochib qo'ygan edi:
   *
   *   1. `POST /auth/send-otp` javob tanasida OTP kodini QAYTARARDI — ya'ni
   *      telefon raqamini bilgan har qanday odam istalgan hisobga kira
   *      olardi;
   *   2. OTP bypass ikkinchi darvozani (`ALLOW_OTP_BYPASS_IN_PROD`) talab
   *      qilmasdi;
   *   3. TypeORM `synchronize` standart bo'yicha YONIQ bo'lardi — jonli
   *      sxema har deployda entity'lardan qayta yozilardi;
   *   4. CORS yumshoq dev siyosatiga tushardi;
   *   5. Xato javoblari stack trace bilan chiqardi.
   *
   * Sozlamaning YO'QLIGI eng xavfsiz emas, eng OCHIQ holatni bergani —
   * teskari mantiq. Endi qiymat ko'rsatilmasa ilova umuman ko'tarilmaydi:
   * shovqinli va bir zumda tushunarli nosozlik, jim ochiq eshikdan yaxshi.
   */
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  DB_HOST: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  DB_USER: string;

  @IsString()
  DB_PASS: string;

  @IsString()
  DB_NAME: string;

  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number;

  // Single signing key for every JWT the platform issues, so its entropy is the
  // ceiling on token security. 32 chars is the floor for HMAC-SHA256; a shorter
  // key is brute-forceable offline from any captured token.
  //
  // ⚠️ This can fail a running deployment whose APP_SECRET is shorter. That is
  // intentional — such a key must actually be replaced (and all tokens signed
  // with it are invalidated by the rotation, forcing users to log in again).
  @IsString()
  @MinLength(32, {
    message: 'APP_SECRET must be at least 32 characters long',
  })
  APP_SECRET: string;

  // Token lifetimes, tunable without a redeploy. Format: seconds, or a value
  // like 15m / 12h / 7d.
  //
  // ⚠️ Defaults stay long on purpose: the mobile app has no refresh flow yet
  // (a 401 logs the user out) and the web panels do not store refresh tokens.
  // Shorten JWT_ACCESS_TTL (e.g. to '15m') only once updated clients are out.
  @IsString()
  @Matches(/^\d+\s*[smhd]?$/i, {
    message: 'JWT_ACCESS_TTL must be seconds or a value like 15m, 12h, 7d',
  })
  @IsOptional()
  JWT_ACCESS_TTL: string = DEFAULT_ACCESS_TTL;

  @IsString()
  @Matches(/^\d+\s*[smhd]?$/i, {
    message: 'JWT_REFRESH_TTL must be seconds or a value like 15m, 12h, 7d',
  })
  @IsOptional()
  JWT_REFRESH_TTL: string = DEFAULT_REFRESH_TTL;

  @IsString()
  @IsOptional()
  ESKIZ_EMAIL: string = '';

  @IsString()
  @IsOptional()
  ESKIZ_PASSWORD: string = '';

  // Ruscha OTP shabloni Eskiz kabinetida moderatsiyadan o'tgach `true`.
  // Unga qadar ruscha ilova ham o'zbekcha SMS oladi (sms-texts.ts).
  @IsString()
  @IsOptional()
  ESKIZ_RU_TEMPLATE_APPROVED: string = 'false';

  @IsString()
  @IsOptional()
  PAYME_MERCHANT_ID: string = '';

  @IsString()
  @IsOptional()
  PAYME_SECRET_KEY: string = '';

  // Egasiga kunlik/haftalik moliya hisobotlari (modules/business-reports).
  // Server alertlari (deploy/oracle/lib.sh) bilan bir xil bot.
  @IsString()
  @IsOptional()
  TELEGRAM_BOT_TOKEN: string = '';

  @IsString()
  @IsOptional()
  TELEGRAM_CHAT_ID: string = '';

  // `X-Reports-Key` — egasining Claude skill'lari uchun hisobot API'si.
  // 32 belgidan qisqa bo'lsa API yopiq (`reports-key.guard.ts`).
  @IsString()
  @IsOptional()
  REPORTS_API_KEY: string = '';

  // ⚠️ `@Transform(envBoolean)` MAJBURIY: implicit conversion "false" ni
  // `true` qilardi (`common/utils/env-boolean.util.ts`). Har bir yangi boolean
  // env shu naqsh bilan e'lon qilinsin.
  @Transform(envBoolean)
  @IsBoolean()
  @IsOptional()
  OTP_BYPASS_ENABLED: boolean = false;

  // Hamyonni karta orqali to'ldirgandan keyin foydalanuvchi qaytadigan manzil
  // (Payme `c`, Click/UZPS `return_url`). `{id}` — to'ldirish id'si bilan
  // almashtiriladi. Masalan `angrengo://wallet/topup/{id}` yoki
  // `https://angrengo.uz/app/wallet/topup/{id}`. Bo'sh — provayder standarti.
  @IsString()
  @IsOptional()
  WALLET_TOPUP_RETURN_URL: string = '';

  // Click Prepare'dan keyin shuncha daqiqa ichida Complete kelmasa, soatlik
  // cron tranzaksiyani bekor deb belgilaydi (pulga ta'siri yo'q).
  @IsNumber()
  @Min(1)
  @IsOptional()
  CLICK_PREPARE_TTL_MINUTES: number = 60;

  // Base URL of the OSRM routing server used for ETA-ranked dispatch and
  // snap-to-road trip distances, e.g. http://osrm:5000.
  //
  // Left empty, OsrmService falls back to OSRM's public demo server and logs a
  // warning — that server is rate-limited and carries no SLA, so production
  // must set this.
  @IsString()
  @IsOptional()
  OSRM_URL: string = '';

  // Upload storage — see StorageModule. `s3` needs the S3_* values below and
  // refuses to boot without them rather than silently writing to local disk.
  @IsString()
  @IsOptional()
  STORAGE_DRIVER: string = 'local';

  // Fiskal chek provayderi (modules/fiscal). Haqiqiy OFD integratsiyasi hali
  // yo'q — `noop` yozuvni `skipped` holatida saqlaydi.
  @IsString()
  @IsOptional()
  FISCAL_PROVIDER: string = 'noop';

  @IsString()
  @IsOptional()
  S3_BUCKET: string = '';

  @IsString()
  @IsOptional()
  S3_REGION: string = 'auto';

  @IsString()
  @IsOptional()
  S3_ENDPOINT: string = '';

  @IsString()
  @IsOptional()
  S3_ACCESS_KEY_ID: string = '';

  @IsString()
  @IsOptional()
  S3_SECRET_ACCESS_KEY: string = '';
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors
        .map((e) => Object.values(e.constraints || {}).join(', '))
        .join('\n')}`,
    );
  }

  return validatedConfig;
}
