import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { BroadcastAudience } from '../../../database/entities/push-notification-log.entity';

export class BroadcastDto {
  @ApiProperty({ example: 'Weekend promo' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiProperty({ example: '20% off all rides this weekend!' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body: string;

  @ApiProperty({ enum: BroadcastAudience })
  @IsEnum(BroadcastAudience)
  audience: BroadcastAudience;
}
