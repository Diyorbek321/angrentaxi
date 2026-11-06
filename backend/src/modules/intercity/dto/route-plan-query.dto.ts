import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, ValidateIf } from 'class-validator';

/** `GET /intercity/trips/:id/route-plan` — haydovchining hozirgi joyi (ixtiyoriy, juft). */
export class RoutePlanQueryDto {
  @ApiPropertyOptional({ example: 41.31 })
  @ValidateIf((dto: RoutePlanQueryDto) => dto.fromLat !== undefined || dto.fromLng !== undefined)
  @Type(() => Number)
  @IsLatitude()
  fromLat?: number;

  @ApiPropertyOptional({ example: 69.28 })
  @ValidateIf((dto: RoutePlanQueryDto) => dto.fromLat !== undefined || dto.fromLng !== undefined)
  @Type(() => Number)
  @IsLongitude()
  fromLng?: number;
}
