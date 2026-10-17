import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { IntercityTripClass } from '../../../database/entities/intercity-trip.entity';

/** `POST /intercity/trips` — haydovchi qatnov e'lon qiladi. */
export class PublishIntercityTripDto {
  @ApiProperty({ description: "Yo'nalish UUID" })
  @IsUUID()
  routeId: string;

  @ApiProperty({ example: '2026-10-18T02:00:00.000Z', description: "Jo'nash vaqti (ISO)" })
  @IsDateString()
  departureAt: string;

  // Yuqori chegara yo'nalish standartiga qarab servisda tekshiriladi;
  // bu yerda faqat jadval CHECK'i (1–8).
  @ApiPropertyOptional({ example: 4, description: "O'rindiqlar soni (standart — yo'nalishniki)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  seatsTotal?: number;

  @ApiProperty({ enum: IntercityTripClass, example: IntercityTripClass.START })
  @IsEnum(IntercityTripClass)
  tripClass: IntercityTripClass;

  /**
   * Olish tomonidagi tumanlar (masalan, Toshkent → Angren: Chilonzor,
   * Yunusobod). Bo'sh yoki yo'q — butun davom hududi.
   */
  @ApiPropertyOptional({ type: [String], description: 'Olish tomonidagi tumanlar (bo\'sh — hammasi)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('all', { each: true })
  originZoneIds?: string[];

  /** Tushirish tomonidagi tumanlar (Angren → Toshkent: Yunusobod, Mirzo Ulug'bek...). */
  @ApiPropertyOptional({ type: [String], description: 'Tushirish tomonidagi tumanlar (bo\'sh — hammasi)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('all', { each: true })
  destinationZoneIds?: string[];
}
