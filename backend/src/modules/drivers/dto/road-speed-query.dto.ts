import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * `GET /road-speed` uchun so'rov parametrlari.
 *
 * Nuqta (lat/lng) talab qilinadi, zona indeksi emas: chaqiruvchi (marshrut
 * hisoblovchi kod yoki menejer paneli) H3 hujayra indeksini emas,
 * koordinatani biladi. Hujayraga o'girish servis tomonida bo'lgani uchun
 * rezolyutsiya kelajakda o'zgarsa ham chaqiruvchilar buzilmaydi.
 *
 * `@Type(() => Number)` har bir maydonda aniq ko'rsatilgan — query parametrlar
 * satr bo'lib keladi, bu bo'lmasa `@IsNumber()` to'g'ri so'rovni ham rad etadi
 * (loyihadagi boshqa query DTO'lar bilan bir xil uslub).
 */
export class RoadSpeedQueryDto {
  @ApiProperty({ example: 41.0212, description: 'Nuqta kengligi' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat: number;

  @ApiProperty({ example: 70.0795, description: 'Nuqta uzunligi' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lng: number;

  // Kun/soat berilmasa hozirgi vaqt olinadi: "hozir bu zonada qanday
  // yuriladi" — eng ko'p so'raladigan savol, va u marshrutni jonli
  // hisoblashda kerak bo'ladi.
  @ApiPropertyOptional({
    minimum: 0,
    maximum: 6,
    description: 'Hafta kuni (0 = yakshanba). Berilmasa — hozirgi kun',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  @Type(() => Number)
  dayOfWeek?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 23,
    description: 'Soat (0..23, Toshkent vaqti). Berilmasa — hozirgi soat',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  @Type(() => Number)
  hourOfDay?: number;
}
