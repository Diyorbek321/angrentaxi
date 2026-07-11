import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { StoreDeliveryMode } from '../../../database/entities/store.entity';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class UpdateStoreDto {
  @ApiPropertyOptional({ example: 'Dehqon Bozori' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: "Angren sh., Bozor ko'chasi 14" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_RE, { message: 'workingHoursStart must be HH:mm' })
  workingHoursStart?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_RE, { message: 'workingHoursEnd must be HH:mm' })
  workingHoursEnd?: string;

  @ApiPropertyOptional({ enum: StoreDeliveryMode })
  @IsOptional()
  @IsEnum(StoreDeliveryMode)
  deliveryMode?: StoreDeliveryMode;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ example: 40.0956, description: 'Pickup latitude for courier dispatch' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 70.9432, description: 'Pickup longitude for courier dispatch' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
