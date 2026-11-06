import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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

  // Ixtiyoriy: bo'sh qoldirilsa ruscha foydalanuvchilar o'zbekcha matnni oladi.
  @ApiPropertyOptional({ example: 'Скидка на выходные' })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  titleRu?: string;

  @ApiPropertyOptional({ example: 'Скидка 20% на все поездки в выходные!' })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bodyRu?: string;

  @ApiProperty({ enum: BroadcastAudience })
  @IsEnum(BroadcastAudience)
  audience: BroadcastAudience;
}
