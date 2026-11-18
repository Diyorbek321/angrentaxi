import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsPhoneNumber, IsString, Length } from 'class-validator';
import { CLIENT_APPS, ClientApp } from '../session-role';

export class VerifyOtpDto {
  @ApiProperty({
    example: '+998901234567',
    description: 'Phone number in international format',
  })
  @IsString()
  @IsPhoneNumber('UZ')
  phone: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code',
  })
  @IsString()
  @Length(6, 6, { message: 'OTP code must be exactly 6 digits' })
  code: string;

  @ApiPropertyOptional({
    enum: CLIENT_APPS,
    description:
      "Qaysi ilovadan kirilyapti. Haydovchi raqami 'passenger' bilan kirsa, sessiya roli " +
      "yo'lovchi bo'ladi. Berilmasa — bazadagi rol (eski ilovalar).",
  })
  @IsOptional()
  @IsIn(CLIENT_APPS)
  app?: ClientApp;
}
