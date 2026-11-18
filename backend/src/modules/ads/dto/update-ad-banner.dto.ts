import { ApiPropertyOptional } from '@nestjs/swagger';
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

/**
 * JSON tana. Rasm bu yerda O'ZGARMAYDI: rasm o'zgarsa bu boshqa reklama —
 * yangi banner yaratiladi va eski hisoblagichlar aralashib ketmaydi.
 * `null` — maydonni tozalash (masalan muddatni olib tashlash),
 * maydon yo'q — o'zgarmaydi.
 */
export class UpdateAdBannerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ enum: AdLinkType })
  @IsOptional()
  @IsEnum(AdLinkType)
  linkType?: AdLinkType;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkTarget?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}
