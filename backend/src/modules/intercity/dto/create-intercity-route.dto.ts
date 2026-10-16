import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { INTERCITY_SEATS_MAX, INTERCITY_SEATS_MIN } from '../intercity-route-policy';

/** So'mning tiyini yo'q — narx butun son. Yuqori chegara xato raqamdan himoya. */
const MAX_PRICE = 10_000_000;

/**
 * Narxlar orasidagi munosabat (butun mashina ≥ o'rindiq, Comfort ≥ Start)
 * DTO'da emas, `intercity-route-policy.ts` da tekshiriladi — PATCH'da u
 * bazadagi qiymat bilan BIRLASHTIRILGAN natijaga qo'llanishi kerak.
 */
export class CreateIntercityRouteDto {
  @ApiProperty({ description: "Jo'nash nuqtasi (intercity_points.id)" })
  @IsUUID()
  originPointId: string;

  @ApiProperty({ description: 'Borish nuqtasi (intercity_points.id)' })
  @IsUUID()
  destinationPointId: string;

  @ApiProperty({ example: 25000, description: "Start klass, bitta o'rindiq, so'm" })
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  @Max(MAX_PRICE)
  seatPrice: number;

  @ApiProperty({ example: 100000, description: "Start klass, butun mashina, so'm" })
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  @Max(MAX_PRICE)
  wholeCarPrice: number;

  @ApiPropertyOptional({ example: 30000, nullable: true, description: "Comfort o'rindiq; null — Comfort yo'q" })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  @Max(MAX_PRICE)
  comfortSeatPrice?: number | null;

  @ApiPropertyOptional({ example: 120000, nullable: true, description: "Comfort butun mashina; null — Comfort yo'q" })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  @Max(MAX_PRICE)
  comfortWholeCarPrice?: number | null;

  @ApiPropertyOptional({ example: 4, default: 4 })
  @IsOptional()
  @IsInt()
  @Min(INTERCITY_SEATS_MIN)
  @Max(INTERCITY_SEATS_MAX)
  seatsDefault?: number;

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
