import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LEAD_TYPES, LeadType } from '../../../database/entities/lead.entity';
import { COURIER_VEHICLES, normalizeUzPhone, PARTNER_BUSINESS_TYPES } from '../leads.constants';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const MAX_CAR_YEAR = new Date().getFullYear() + 1;

export class CreateLeadDto {
  @ApiProperty({ enum: LEAD_TYPES })
  @IsIn(LEAD_TYPES)
  type: LeadType;

  @ApiProperty({ example: 'Aziz Karimov' })
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  @Matches(/^[\p{L}\p{M}' .\-ʻʼ‘’]+$/u, { message: 'name must contain letters only' })
  name: string;

  @ApiProperty({ example: '+998901234567' })
  @Transform(({ value }) => normalizeUzPhone(value))
  @Matches(/^\+998\d{9}$/, { message: 'phone must be an Uzbek number +998XXXXXXXXX' })
  phone: string;

  /** Shaxsiy ma'lumotlarga rozilik — `true` bo'lmasa 400. */
  @ApiProperty({ example: true })
  @Equals(true)
  consent: boolean;

  @ApiPropertyOptional({ enum: ['uz', 'ru'] })
  @IsOptional()
  @IsIn(['uz', 'ru'])
  lang?: 'uz' | 'ru';

  // --- haydovchi ---
  @ApiPropertyOptional({ example: 'Chevrolet Cobalt' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  carModel?: string;

  @ApiPropertyOptional({ example: 2019 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1990)
  @Max(MAX_CAR_YEAR)
  carYear?: number;

  // --- kuryer ---
  @ApiPropertyOptional({ enum: COURIER_VEHICLES })
  @IsOptional()
  @IsIn(COURIER_VEHICLES)
  vehicle?: string;

  // --- hamkor ---
  @ApiPropertyOptional({ example: 'Lazzat oshxonasi' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  businessName?: string;

  @ApiPropertyOptional({ enum: PARTNER_BUSINESS_TYPES })
  @IsOptional()
  @IsIn(PARTNER_BUSINESS_TYPES)
  businessType?: string;

  @ApiPropertyOptional({ example: 'Angren, Navoiy ko‘chasi 12' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  comment?: string;

  /** Honeypot: odam ko'rmaydi, bot to'ldiradi. To'ldirilgan bo'lsa jim tashlanadi. */
  @ApiPropertyOptional({ description: 'Must stay empty' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
