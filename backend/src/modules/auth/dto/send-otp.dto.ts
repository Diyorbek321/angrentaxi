import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    example: '+998901234567',
    description: 'Phone number in international format',
  })
  @IsString()
  @IsPhoneNumber('UZ')
  phone: string;
}
