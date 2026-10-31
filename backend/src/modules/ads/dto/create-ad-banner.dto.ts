import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AdLinkType } from '../../../database/entities/ad-banner.entity';
import { formBoolean } from '../../../common/utils/form-boolean.util';

// Multipart forma hamma maydonni SATR qilib yuboradi: bo'sh maydon "" bo'lib
// keladi, mantiqiy qiymat "true"/"false". `enableImplicitConversion` esa
// "false" ni `true` ga aylantirib yuborardi — shuning uchun `formBoolean`.
export const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class CreateAdBannerDto {
  @ApiProperty({ example: 'Lavash Center — 20% chegirma' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ enum: AdLinkType, default: AdLinkType.NONE })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEnum(AdLinkType)
  linkType?: AdLinkType;

  @ApiPropertyOptional({ description: 'Restoran/do\'kon UUID yoki https:// havola' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkTarget?: string;

  @ApiPropertyOptional({ example: '2026-10-10T00:00:00+05:00' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-11-10T00:00:00+05:00' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ default: true })
  @Transform(formBoolean)
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}
