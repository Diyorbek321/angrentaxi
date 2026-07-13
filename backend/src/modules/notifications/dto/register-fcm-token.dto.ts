import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterFcmTokenDto {
  @ApiProperty({ example: 'fcm-device-token' })
  @IsString()
  @MinLength(10)
  token: string;

  @ApiProperty({ example: 'android', required: false })
  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: string;

  // Informational only (which flavor of the app registered) — the token is
  // always stored against the authenticated user regardless of role.
  @ApiProperty({ example: 'passenger', required: false })
  @IsOptional()
  @IsString()
  role?: string;
}
