import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { normalizeRegion, UZ_REGION_CODES, UzRegionCode } from '../../../common/regions/uz-regions';
import { DriverTaxStatus } from '../../../database/entities/driver.entity';

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Haydovchining huquqiy profili (VMQ 200, PQ-247). Hamma maydon ixtiyoriy —
 * faqat yuborilgani o'zgaradi. `null` — maydonni tozalaydi (fuqarolikdan
 * tashqari).
 */
export class UpdateDriverLegalDto {
  @ApiPropertyOptional({ enum: DriverTaxStatus, nullable: true })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsEnum(DriverTaxStatus)
  taxStatus?: DriverTaxStatus | null;

  @ApiPropertyOptional({ example: '12345678901234', nullable: true, description: 'JShShIR, 14 raqam' })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Matches(/^\d{14}$/, { message: "JShShIR (PINFL) 14 ta raqamdan iborat bo'lishi kerak" })
  pinfl?: string | null;

  @ApiPropertyOptional({ example: '123456789', nullable: true, description: 'STIR (INN), 9 raqam — YaTT uchun' })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Matches(/^\d{9}$/, { message: "STIR (INN) 9 ta raqamdan iborat bo'lishi kerak" })
  tin?: string | null;

  @ApiPropertyOptional({ example: '1990-05-01', nullable: true })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Matches(ISO_DATE, { message: "birthDate YYYY-MM-DD formatida bo'lishi kerak" })
  birthDate?: string | null;

  @ApiPropertyOptional({ example: '2015-03-10', nullable: true, description: 'B toifali guvohnoma berilgan sana' })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Matches(ISO_DATE, { message: "drivingLicenceIssuedAt YYYY-MM-DD formatida bo'lishi kerak" })
  drivingLicenceIssuedAt?: string | null;

  @ApiPropertyOptional({ example: 'TL-000123', nullable: true, description: 'Taksi litsenziya varaqasi raqami' })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @MaxLength(50)
  taxiLicenceNumber?: string | null;

  /**
   * Hudud kodi (ISO 3166-2:UZ). Eski ilova erkin matn yuboradi ("Toshkent
   * viloyati") — kodga aylantiriladi; tanilmasa 400, bo'sh satr — tozalash.
   */
  @ApiPropertyOptional({ enum: UZ_REGION_CODES, example: 'UZ-TO', nullable: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string' && value.trim() === '') return null;
    return typeof value === 'string' ? (normalizeRegion(value) ?? value) : value;
  })
  @ValidateIf((_o, value) => value !== null)
  @IsIn(UZ_REGION_CODES, { message: "taxiLicenceRegion ro'yxatdagi hududlardan biri bo'lishi kerak" })
  taxiLicenceRegion?: UzRegionCode | null;

  @ApiPropertyOptional({ example: 'UZ', description: 'ISO 3166-1 alpha-2' })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, { message: "citizenship 2 harfli ISO kod bo'lishi kerak (masalan UZ)" })
  citizenship?: string;
}
