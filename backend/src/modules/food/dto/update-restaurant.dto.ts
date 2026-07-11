import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class WorkingHoursDayDto {
  @IsString()
  day: string;

  @IsBoolean()
  open: boolean;

  @IsString()
  from: string;

  @IsString()
  to: string;
}

class NotificationsDto {
  @IsBoolean()
  sound: boolean;

  @IsBoolean()
  push: boolean;

  @IsBoolean()
  sms: boolean;
}

export class UpdateRestaurantDto {
  @ApiPropertyOptional({ example: 'Mix Burger' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ type: [WorkingHoursDayDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursDayDto)
  hours?: WorkingHoursDayDto[];

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  deliveryRadiusKm?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  commissionRate?: number;

  @ApiPropertyOptional({ type: NotificationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationsDto)
  notifications?: NotificationsDto;

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
