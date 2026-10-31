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
  ValidateIf,
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

  /** Davom chegarasi (km, to'g'ri chiziq). 0 — o'chiq. Qoidalar: `intercity-point-policy.ts`. */
  @ApiPropertyOptional({ example: 30, default: 0, description: "Shahar ichiga davom: max km (0 — o'chiq)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  extensionMaxKm?: number;

  @ApiPropertyOptional({ example: 2000, default: 0, description: "Davom narxi, Start (so'm/km)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50_000)
  extensionPricePerKm?: number;

  @ApiPropertyOptional({ example: 2500, nullable: true, description: "Davom narxi, Comfort (so'm/km); null — Start narxi" })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(50_000)
  extensionComfortPricePerKm?: number | null;

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
