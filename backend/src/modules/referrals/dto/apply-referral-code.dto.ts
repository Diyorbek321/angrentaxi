import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ApplyReferralCodeDto {
  @ApiProperty({ example: 'AB12CD', description: 'Referral code shared by another user' })
  @IsString()
  @Length(1, 10)
  code: string;
}
