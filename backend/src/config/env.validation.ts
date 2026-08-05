import { plainToInstance } from 'class-transformer';
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

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

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

  @IsString()
  @IsOptional()
  PAYME_MERCHANT_ID: string = '';

  @IsString()
  @IsOptional()
  PAYME_SECRET_KEY: string = '';

  @IsBoolean()
  @IsOptional()
  OTP_BYPASS_ENABLED: boolean = false;
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
