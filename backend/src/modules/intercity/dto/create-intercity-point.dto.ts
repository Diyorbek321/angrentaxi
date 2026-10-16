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

export class CreateIntercityPointDto {
  @ApiProperty({ example: 'Rohat krugi (Toshkent)' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 41.3111 })
  @IsLatitude()
  centerLat: number;

  @ApiProperty({ example: 69.2797 })
  @IsLongitude()
  centerLng: number;

  /**
   * ⚠️ 50 km chegara ATAYLAB: nuqta — bekat yoki shahar, viloyat emas.
   * Xato bilan kiritilgan katta radius "Rohat krugi" nuqtasini butun Toshkentga
   * aylantirib, yo'lovchini shahar chekkasidan olish va'dasini berardi.
   */
  @ApiProperty({ example: 5, description: 'Olish/tushirish radiusi (km)' })
  @IsNumber()
  @Min(0.5)
  @Max(50)
  radiusKm: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
