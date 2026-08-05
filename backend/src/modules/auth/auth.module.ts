import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenCleanupService } from './refresh-token-cleanup.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Otp } from '../../database/entities/otp.entity';
import { User } from '../../database/entities/user.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { DEFAULT_ACCESS_TTL } from './token-ttl.util';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Otp, User, RefreshToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      // No 'fallback-secret' default: env validation already makes APP_SECRET
      // mandatory (min 32 chars), and a hardcoded fallback would silently let a
      // misconfigured deploy sign tokens with a secret published in this repo.
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('APP_SECRET'),
        // Per-call signOptions in AuthService override this; it only covers any
        // direct JwtService.sign() elsewhere. Configurable via JWT_ACCESS_TTL.
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_TTL') || DEFAULT_ACCESS_TTL,
        },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenCleanupService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule, PassportModule],
})
export class AuthModule {}
