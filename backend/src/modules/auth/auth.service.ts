import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, LessThan } from 'typeorm';
import { Otp } from '../../database/entities/otp.entity';
import { User, UserRole, UserStatus } from '../../database/entities/user.entity';
import { EskizService } from '../notifications/eskiz.service';

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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Otp)
    private readonly otpRepository: Repository<Otp>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

    const otpBypassEnabled =
      this.configService.get<string>('OTP_BYPASS_ENABLED') === 'true' ||
      this.configService.get<boolean>('OTP_BYPASS_ENABLED') === true;
    const bypassCode = this.configService.get<string>('OTP_BYPASS_CODE') || '123456';

    // In dev/bypass mode use the fixed bypass code so testers can always log in
    // with a known value; otherwise generate a random 6-digit code.
    const code = otpBypassEnabled ? bypassCode : this.generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.otpRepository.save({
      phone,
      code,
      isUsed: false,
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

  async verifyOtp(phone: string, code: string): Promise<AuthResult> {
    const otp = await this.otpRepository.findOne({
      where: {
        phone,
        code,
        isUsed: false,
      },
    });

    if (!otp) {
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
      user = await this.userRepository.save({
        phone,
        role: UserRole.PASSENGER,
        status: UserStatus.ACTIVE,
        firstName: null,
        lastName: null,
        fcmToken: null,
      });
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException('Account is blocked');
    }

    const tokens = this.generateTokenPair(user);

    return { ...tokens, user };
  }

  async refreshToken(refreshTokenValue: string): Promise<Pick<TokenPair, 'accessToken'>> {
    try {
      const secret = this.configService.get<string>('APP_SECRET', 'fallback-secret');
      const payload = this.jwtService.verify<JwtPayload>(refreshTokenValue, { secret });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.userRepository.findOne({ where: { id: payload.sub } });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.status === UserStatus.BLOCKED) {
        throw new UnauthorizedException('Account is blocked');
      }

      const accessToken = this.jwtService.sign(
        { sub: user.id, phone: user.phone, role: user.role, type: 'access' },
        { expiresIn: '7d' },
      );

      return { accessToken };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private generateTokenPair(user: User): TokenPair {
    const payload: Omit<JwtPayload, 'type'> = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      { expiresIn: '7d' },
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: '30d' },
    );

    return { accessToken, refreshToken };
  }

  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
