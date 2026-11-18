import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { INTERCITY_ZONE_RADIUS_MAX_KM, INTERCITY_ZONE_RADIUS_MIN_KM } from '../intercity-zone-policy';

/** `POST /intercity/points/manage/:id/zones` — nuqta atrofidagi tuman. */
export class CreateIntercityZoneDto {
  @ApiProperty({ example: 'Yunusobod' })
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 41.365 })
  @IsLatitude()
  centerLat: number;

  @ApiProperty({ example: 69.288 })
  @IsLongitude()
  centerLng: number;

  @ApiProperty({ example: 4, description: 'Tuman radiusi (km)' })
  @IsNumber()
  @Min(INTERCITY_ZONE_RADIUS_MIN_KM)
  @Max(INTERCITY_ZONE_RADIUS_MAX_KM)
  radiusKm: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
