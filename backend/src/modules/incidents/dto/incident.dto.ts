import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { INCIDENT_CATEGORIES } from '../incident-policy';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const VERTICALS = ['taxi', 'food', 'market'] as const;
/** `driver` = `courier` (taksida haydovchi). Menejer ochganda kim haqida ekanini tanlaydi. */
export const SUBJECT_CHOICES = ['courier', 'driver', 'vendor', 'customer'] as const;
export const OUTCOME_TYPES = ['warning', 'suspension', 'block', 'refund', 'compensation', 'penalty', 'no_action'] as const;

export class ReportIncidentDto {
  @ApiProperty({ enum: VERTICALS, description: 'taxi — `orders` (taksi/posilka/yuk), food/market — sotuvchi buyurtmasi' })
  @IsIn(VERTICALS)
  vertical: (typeof VERTICALS)[number];

  @ApiProperty()
  @IsUUID()
  orderId: string;

  @ApiProperty({ enum: INCIDENT_CATEGORIES })
  @IsIn(INCIDENT_CATEGORIES)
  category: string;

  @ApiProperty({ example: 'Haydovchi qo\'pol gapirdi', maxLength: 1000 })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  description: string;

  @ApiPropertyOptional({ enum: SUBJECT_CHOICES, description: 'Ovqat/market: kim haqida (kuryer, sotuvchi yoki mijoz)' })
  @IsOptional()
  @IsIn(SUBJECT_CHOICES)
  subject?: (typeof SUBJECT_CHOICES)[number];
}

export class IncidentOutcomeDto {
  @ApiProperty({ enum: OUTCOME_TYPES })
  @IsIn(OUTCOME_TYPES)
  type: (typeof OUTCOME_TYPES)[number];

  @ApiPropertyOptional({ description: "Pul natijalarida summa, so'm" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount?: number;

  @ApiPropertyOptional({ description: "To'xtatish kunlari (standart — `suspensionDays`)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({ enum: ['wallet', 'card'] })
  @IsOptional()
  @IsIn(['wallet', 'card'])
  refundMethod?: 'wallet' | 'card';
}

export class ResolveIncidentDto {
  @ApiProperty({ enum: ['resolved', 'rejected'] })
  @IsIn(['resolved', 'rejected'])
  status: 'resolved' | 'rejected';

  @ApiProperty({ description: 'Qaror izohi — MAJBURIY', maxLength: 1000 })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Qaror izohini yozing (kamida 3 belgi)' })
  @MaxLength(1000)
  note: string;

  @ApiPropertyOptional({ description: 'Shikoyat subyektga qarshi tasdiqlandi (jarima zinapoyasi shu bilan sanaydi)' })
  @IsOptional()
  @IsBoolean()
  confirmedAgainstSubject?: boolean;

  @ApiPropertyOptional({ type: [IncidentOutcomeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => IncidentOutcomeDto)
  outcomes?: IncidentOutcomeDto[];

  @ApiPropertyOptional({ enum: ['upheld', 'overturned'], description: "E'tiroz bo'yicha qaror (faqat admin)" })
  @IsOptional()
  @IsIn(['upheld', 'overturned'])
  appealDecision?: 'upheld' | 'overturned';
}

export class AppealIncidentDto {
  @ApiProperty({ maxLength: 1000 })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  note: string;
}

export class ListIncidentsQueryDto {
  @IsOptional()
  @IsIn(['open', 'investigating', 'resolved', 'rejected', 'active'])
  status?: 'open' | 'investigating' | 'resolved' | 'rejected' | 'active';

  @IsOptional()
  @IsIn(INCIDENT_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsIn(VERTICALS)
  vertical?: (typeof VERTICALS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
