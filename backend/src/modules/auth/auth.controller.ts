import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Recorded on the refresh-token row so a reuse alert can be traced back to a
  // device. Truncated to the column width; never used for authorization.
  private sessionContext(req: Request) {
    return {
      userAgent: (req.headers['user-agent'] || '').slice(0, 255) || null,
      ip: (req.ip || '').slice(0, 64) || null,
    };
  }

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  // Tightens the 'long' (60s) window declared in AppModule from 200 to 5.
  // The throttler name must match one configured in ThrottlerModule.forRoot —
  // an unknown name (e.g. 'default') is silently ignored, leaving the route
  // on the global limit.
  @Throttle({ long: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Send OTP to phone number',
    description: 'Sends a 6-digit OTP code via SMS. Rate limited to 5 requests per minute.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          properties: {
            message: { type: 'string', example: 'OTP sent successfully' },
            code: {
              type: 'string',
              example: '123456',
              description: 'Only present when OTP_BYPASS_ENABLED=true (dev mode)',
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid phone number' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  // Per-IP brake on code guessing; AuthService additionally burns an OTP after
  // 5 wrong attempts, which caps guessing per phone number regardless of IP.
  @Throttle({ long: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Verify OTP and authenticate',
    description:
      'Verifies the OTP code and returns JWT tokens. Creates user if not exists. ' +
      'Rate limited to 10 requests per minute; the OTP is invalidated after 5 wrong codes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: {
              properties: {
                id: { type: 'string' },
                phone: { type: 'string' },
                name: { type: 'string', nullable: true },
                role: { type: 'string' },
                status: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP, or attempt limit reached' })
  @ApiResponse({ status: 401, description: 'Account blocked' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.authService.verifyOtp(dto.phone, dto.code, this.sessionContext(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Returns a NEW access token AND a NEW refresh token. The refresh token is ' +
      'rotated on every call: the one sent in the request is revoked immediately, ' +
      'so the client must store the returned refreshToken and use it next time. ' +
      'Presenting an already-used refresh token revokes every session of that user.',
  })
  @ApiResponse({
    status: 200,
    description: 'New token pair',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid, expired, revoked or reused refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refreshToken(dto.refreshToken, this.sessionContext(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log out (revoke a refresh token)',
    description:
      'Revokes the supplied refresh token so it can no longer be exchanged. ' +
      'Idempotent: always returns 200, even for an unknown or already revoked ' +
      'token, so it cannot be used to probe which tokens exist. Already-issued ' +
      'access tokens stay valid until they expire.',
  })
  @ApiResponse({
    status: 200,
    description: 'Refresh token revoked',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          properties: {
            message: { type: 'string', example: 'Logged out successfully' },
          },
        },
      },
    },
  })
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
