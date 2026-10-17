import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsUUID, Matches, ValidateIf } from 'class-validator';

/**
 * `GET /intercity/trips?routeId=&date=` — sana Toshkent kuni.
 *
 * Ixtiyoriy manzil (`pickupLat/Lng`, `dropoffLat/Lng`): berilsa har qatnovga
 * `fit` belgisi qo'shiladi — "sizning tomonga" / "boshqa tumanga" /
 * "+N daqiqa aylanma". Koordinata juft keladi: biri bo'lsa ikkinchisi shart.
 */
export class SearchIntercityTripsDto {
  @ApiProperty({ description: "Yo'nalish UUID" })
  @IsUUID()
  routeId: string;

  @ApiProperty({ example: '2026-10-18', description: 'Toshkent kuni (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiPropertyOptional({ example: 40.1 })
  @ValidateIf((dto: SearchIntercityTripsDto) => dto.pickupLat !== undefined || dto.pickupLng !== undefined)
  @Type(() => Number)
  @IsLatitude()
  pickupLat?: number;

  @ApiPropertyOptional({ example: 70.95 })
  @ValidateIf((dto: SearchIntercityTripsDto) => dto.pickupLat !== undefined || dto.pickupLng !== undefined)
  @Type(() => Number)
  @IsLongitude()
  pickupLng?: number;

  @ApiPropertyOptional({ example: 41.365 })
  @ValidateIf((dto: SearchIntercityTripsDto) => dto.dropoffLat !== undefined || dto.dropoffLng !== undefined)
  @Type(() => Number)
  @IsLatitude()
  dropoffLat?: number;

  @ApiPropertyOptional({ example: 69.288 })
  @ValidateIf((dto: SearchIntercityTripsDto) => dto.dropoffLat !== undefined || dto.dropoffLng !== undefined)
  @Type(() => Number)
  @IsLongitude()
  dropoffLng?: number;

  // `IsOptional` kerak emas: `ValidateIf` juft yo'q bo'lsa tekshiruvni o'tkazib yuboradi.
}
