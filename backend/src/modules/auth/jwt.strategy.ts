import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { User, UserStatus } from '../../database/entities/user.entity';
import { explicitLanguage } from '../../common/i18n/error-messages';

interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // No 'fallback-secret' default: env validation already makes APP_SECRET
      // required, and a silent fallback would accept tokens signed with a
      // publicly known key if the variable ever went missing.
      secretOrKey: configService.getOrThrow<string>('APP_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<User> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Access tokens are long-lived, so blocking a user must take effect on the
    // next request rather than only at login/refresh time — otherwise a
    // blocked account keeps working until its access token expires.
    if (user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException('Account is blocked');
    }

    await this.syncLanguage(user, req.headers['accept-language']);
    return user;
  }

  /**
   * Ilova/panel tilini foydalanuvchiga yozadi — push va SMS shu tilda ketadi.
   * Faqat til O'ZGARGANDA bitta UPDATE; xato so'rovni yiqitmaydi (til —
   * qulaylik, autentifikatsiya emas).
   */
  private async syncLanguage(user: User, header: string | string[] | undefined): Promise<void> {
    const language = explicitLanguage(header);
    if (!language || language === user.language) return;
    try {
      await this.usersService.updateLanguage(user.id, language);
      user.language = language;
    } catch (err) {
      this.logger.warn(`Language sync failed for user ${user.id}: ${(err as Error).message}`);
    }
  }
}
