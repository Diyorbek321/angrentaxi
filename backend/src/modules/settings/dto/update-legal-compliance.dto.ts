import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateLegalComplianceDto {
  @ApiPropertyOptional({
    example: '2026-12-01T00:00:00+05:00',
    nullable: true,
    description:
      "VMQ 200 talablarini majburlash sanasi. null — o'chiq (faqat ogohlantirish); kelajak sana — muhlat",
  })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsDateString()
  legalComplianceEnforcedFrom?: string | null;

  @ApiPropertyOptional({ example: 21 })
  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(70)
  minDriverAgeYears?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  minLicenceExperienceYears?: number;

  @ApiPropertyOptional({ example: 15, description: 'Shahar ichida taksi mashinasining eng katta yoshi' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxVehicleAgeYears?: number;

  @ApiPropertyOptional({ description: 'Soliq agenti sifatida ushlab qolish (PQ-247)' })
  @IsOptional()
  @IsBoolean()
  taxWithholdingEnabled?: boolean;

  @ApiPropertyOptional({ example: 1.0, description: 'Ushlab qolish stavkasi, foiz' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  driverTaxWithholdingRate?: number;

  @ApiPropertyOptional({
    example: '301234567',
    nullable: true,
    description: "Platforma STIR'i (9 raqam) — smena kabi platformaning o'z xizmati fiskal yozuvlarida. null — o'chirish",
  })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Matches(/^\d{9}$/, { message: "STIR 9 ta raqamdan iborat bo'lishi kerak" })
  platformTin?: string | null;
}
