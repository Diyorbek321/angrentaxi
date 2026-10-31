import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SurgeService } from '../surge.service';

/**
 * Query DTO for `GET /surge/zones` (the driver's demand map).
 *
 * The centre is required rather than defaulted to the driver's last known
 * location: the app redraws the map as the driver pans it, so the point the
 * hexagons are built around is the map's centre, not the car's.
 *
 * `@Type(() => Number)` is explicit on every field rather than left to the
 * global `enableImplicitConversion`. Query parameters arrive as strings, so
 * without a conversion step `@IsNumber()` rejects a perfectly valid request —
 * and pinning it here means this endpoint keeps working even if that global
 * option is ever tightened. It also matches the repo's other query DTOs.
 *
 * Bounds are declared here as well as clamped in SurgeService because the two
 * failures are different. A driver asking for 40 rings is a bug in the client
 * and deserves a 400 that names the limit; the service-side clamp is what
 * protects Redis when some other caller skips this pipe.
 */
export class SurgeZonesQueryDto {
  @ApiProperty({ example: 41.0212, description: 'Latitude of the map centre' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat: number;

  @ApiProperty({ example: 70.0795, description: 'Longitude of the map centre' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lng: number;

  @ApiPropertyOptional({
    example: SurgeService.DEFAULT_MAP_RINGS,
    default: SurgeService.DEFAULT_MAP_RINGS,
    minimum: 0,
    maximum: SurgeService.MAX_MAP_RINGS,
    description: 'How many rings of hexagons to return around the centre',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(SurgeService.MAX_MAP_RINGS)
  @Type(() => Number)
  rings?: number;
}
