import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, LessThan, MoreThan, IsNull } from 'typeorm';
import { randomInt, createHash } from 'crypto';
import { Otp } from '../../database/entities/otp.entity';
import { User, UserRole, UserStatus } from '../../database/entities/user.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { EskizService } from '../notifications/eskiz.service';
import { generateUniqueReferralCode } from '../../common/utils/referral-code.util';
import {
  DEFAULT_ACCESS_TTL,
  DEFAULT_REFRESH_TTL,
  parseTtlToMs,
} from './token-ttl.util';

interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: User;
}

export interface SendOtpResult {
  message: string;
  code?: string;
}

export interface LogoutResult {
  message: string;
}

// Where the refresh token came from. Recorded on the row so an operator can
// tell a suspicious session apart from the legitimate one after a reuse alert.
export interface SessionContext {
  userAgent?: string | null;
  ip?: string | null;
}

// Wrong-code guesses allowed against a single OTP before it is burned. With a
// 6-digit code (10^6 possibilities) and a 5-minute lifetime, this keeps the
// chance of guessing an OTP at 5 in a million per issued code.
export const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Otp)
    private readonly otpRepository: Repository<Otp>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eskizService: EskizService,
  ) {}

  async sendOtp(phone: string): Promise<SendOtpResult> {
    // Clean up expired OTPs for this phone
    await this.otpRepository.delete({
      phone,
      expiresAt: LessThan(new Date()),
    });

    // Mark previous valid OTPs as used
    await this.otpRepository.update(
      { phone, isUsed: false },
      { isUsed: true },
    );

    const bypassFlagSet =
      this.configService.get<string>('OTP_BYPASS_ENABLED') === 'true' ||
      this.configService.get<boolean>('OTP_BYPASS_ENABLED') === true;
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const explicitlyAllowedInProd =
      this.configService.get<string>('ALLOW_OTP_BYPASS_IN_PROD') === 'true';

    // In production, OTP_BYPASS_ENABLED alone is not enough — a second, explicit
    // flag must also be set. This prevents a real launch from silently inheriting
    // a test-server config where every phone number logs in with a fixed code.
    const otpBypassEnabled = isProduction
      ? bypassFlagSet && explicitlyAllowedInProd
      : bypassFlagSet;
    const bypassCode = this.configService.get<string>('OTP_BYPASS_CODE') || '123456';

    // In dev/bypass mode use the fixed bypass code so testers can always log in
    // with a known value; otherwise generate a random 6-digit code.
    const code = otpBypassEnabled ? bypassCode : this.generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.otpRepository.save({
      phone,
      code,
      isUsed: false,
      attempts: 0,
      expiresAt,
    });

    if (otpBypassEnabled) {
      this.logger.warn(`OTP bypass enabled. Code for ${phone}: ${code}`);
      return { message: 'OTP sent successfully', code };
    }

    await this.eskizService.sendSms(
      phone,
      `Angren Taxi: Your verification code is ${code}. Valid for 5 minutes.`,
    );

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(
    phone: string,
    code: string,
    context: SessionContext = {},
  ): Promise<AuthResult> {
    const otp = await this.otpRepository.findOne({
      where: {
        phone,
        code,
        isUsed: false,
      },
    });

    if (!otp) {
      // A wrong code is the brute-force signal: charge the attempt against the
      // phone's currently active OTP. Throws once the budget is exhausted.
      await this.registerFailedAttempt(phone);
      throw new BadRequestException('Invalid OTP code');
    }

    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('OTP code has expired');
    }

    // Mark OTP as used
    await this.otpRepository.update(otp.id, { isUsed: true });

    // Find or create user
    let user = await this.userRepository.findOne({ where: { phone } });

    if (!user) {
      const referralCode = await generateUniqueReferralCode(this.userRepository);
      user = await this.userRepository.save({
        phone,
        role: UserRole.PASSENGER,
        status: UserStatus.ACTIVE,
        firstName: null,
        lastName: null,
        fcmToken: null,
        referralCode,
        referredByUserId: null,
      });
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException('Account is blocked');
    }

    const tokens = await this.issueTokenPair(user, context);

    return { ...tokens, user };
  }

  // Counts one wrong-code guess against the phone's live OTP and burns the code
  // once MAX_OTP_ATTEMPTS is reached, forcing the attacker back through the
  // rate-limited send-otp endpoint for a fresh code.
  //
  // No live OTP means there is nothing to protect (the caller sees the generic
  // "Invalid OTP code" from verifyOtp), so this is a no-op in that case.
  private async registerFailedAttempt(phone: string): Promise<void> {
    const activeOtp = await this.otpRepository.findOne({
      where: {
        phone,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!activeOtp) {
      return;
    }

    const attempts = (activeOtp.attempts ?? 0) + 1;
    const isExhausted = attempts >= MAX_OTP_ATTEMPTS;

    await this.otpRepository.update(activeOtp.id, {
      attempts,
      isUsed: isExhausted,
    });

    if (isExhausted) {
      this.logger.warn(`OTP burned after ${attempts} failed attempts for ${phone}`);
      throw new BadRequestException(
        'Too many invalid attempts. This code has been cancelled — request a new one.',
      );
    }
  }

  /**
   * Rotating refresh: the presented token is consumed and a brand new pair is
   * returned. Because every refresh token now lives in the database, a stolen
   * one can be revoked, and a token used twice betrays the theft (see below).
   *
   * ⚠️ API CHANGE: this used to return only { accessToken }. It now also
   * returns a new refreshToken, and the old one stops working immediately —
   * clients MUST persist the new refresh token from every refresh response.
   */
  async refreshToken(
    refreshTokenValue: string,
    context: SessionContext = {},
  ): Promise<TokenPair> {
    // Resolved outside the try so a misconfigured server surfaces as a 500,
    // not as a misleading "invalid token" 401 for every user.
    const secret = this.getSecret();

    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshTokenValue, { secret });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const tokenHash = this.hashToken(refreshTokenValue);
      // Tokens issued before refresh persistence shipped have no row here, so
      // they are rejected and the user re-authenticates once. That is the
      // intended trade-off: an unknown token is indistinguishable from a forged
      // or already-purged one.
      const stored = await this.refreshTokenRepository.findOne({ where: { tokenHash } });

      if (!stored) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      if (stored.revokedAt) {
        // Reuse of a token that was already rotated away or logged out: the
        // legitimate client holds the successor, so whoever presented this one
        // has a copy they should not have. Standard OAuth response is to drop
        // the whole token family and force a fresh login.
        await this.revokeAllForUser(stored.userId);
        this.logger.warn(
          `Refresh token reuse detected for user ${stored.userId} — all sessions revoked`,
        );
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      if (stored.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const user = await this.userRepository.findOne({ where: { id: payload.sub } });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.status === UserStatus.BLOCKED) {
        throw new UnauthorizedException('Account is blocked');
      }

      const tokens = await this.issueTokenPair(user, {
        userAgent: context.userAgent ?? stored.userAgent,
        ip: context.ip ?? stored.ip,
      });

      await this.refreshTokenRepository.update(stored.id, {
        revokedAt: new Date(),
        replacedByTokenHash: this.hashToken(tokens.refreshToken),
      });

      return tokens;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Revokes a single refresh token. Deliberately idempotent and silent about
   * unknown tokens — a logout endpoint must never double as an oracle telling
   * the caller whether a token exists.
   */
  async logout(refreshTokenValue: string): Promise<LogoutResult> {
    const stored = await this.refreshTokenRepository.findOne({
      where: { tokenHash: this.hashToken(refreshTokenValue) },
    });

    if (stored && !stored.revokedAt) {
      await this.refreshTokenRepository.update(stored.id, { revokedAt: new Date() });
    }

    return { message: 'Logged out successfully' };
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async issueTokenPair(
    user: User,
    context: SessionContext = {},
  ): Promise<TokenPair> {
    const payload: Omit<JwtPayload, 'type'> = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      { expiresIn: this.getAccessTtl() },
    );

    const refreshTtl = this.getRefreshTtl();
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: refreshTtl },
    );

    await this.refreshTokenRepository.save({
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + parseTtlToMs(refreshTtl)),
      revokedAt: null,
      replacedByTokenHash: null,
      userAgent: context.userAgent ?? null,
      ip: context.ip ?? null,
    });

    return { accessToken, refreshToken };
  }

  // See token-ttl.util.ts for why the defaults are still 7d / 30d.
  private getAccessTtl(): string {
    return this.configService.get<string>('JWT_ACCESS_TTL') || DEFAULT_ACCESS_TTL;
  }

  private getRefreshTtl(): string {
    return this.configService.get<string>('JWT_REFRESH_TTL') || DEFAULT_REFRESH_TTL;
  }

  // No 'fallback-secret' default: a missing APP_SECRET must fail loudly rather
  // than sign tokens with a value that is public knowledge in this repo.
  private getSecret(): string {
    const secret = this.configService.get<string>('APP_SECRET');

    if (!secret) {
      throw new Error('APP_SECRET is not configured');
    }

    return secret;
  }

  // Only the digest is ever stored, so the tokens table is useless to anyone
  // who reads it.
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // crypto.randomInt (CSPRNG) rather than Math.random: Math.random is a
  // predictable PRNG, so an attacker who observes a few codes could narrow the
  // search space for the next one. Range is [100000, 1000000) => 6 digits.
  private generateOtpCode(): string {
    return randomInt(100000, 1000000).toString();
  }
}
