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

export class CreateCityDto {
  @ApiProperty({ example: 'Angren' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 40.0956, description: 'Shahar markazi — kenglik' })
  @IsLatitude()
  centerLat: number;

  @ApiProperty({ example: 70.9432, description: 'Shahar markazi — uzunlik' })
  @IsLongitude()
  centerLng: number;

  /**
   * ⚠️ Yuqori chegara 200 km ATAYLAB: radius shahar qamrovini bildiradi,
   * viloyatni emas. Xato bilan kiritilgan 2000 km butun mamlakatni bitta
   * shaharga aylantirib, qamrov tekshiruvini ma'nosiz qilardi — va buni
   * hech kim sezmasdi, chunki hech narsa buzilmaydi, shunchaki filtr
   * hech qachon ishlamay qo'yadi.
   */
  @ApiProperty({ example: 25, description: 'Qamrov radiusi (km)' })
  @IsNumber()
  @Min(0.5)
  @Max(200)
  radiusKm: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0, description: "Ro'yxatdagi tartib" })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
