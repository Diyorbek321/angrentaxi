import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { OptionalPaginationDto } from '../../../common/dto/optional-pagination.dto';
import { IntercityTripStatus } from '../../../database/entities/intercity-trip.entity';

export class ManageIntercityTripsQueryDto extends OptionalPaginationDto {
  @ApiPropertyOptional({ enum: IntercityTripStatus })
  @IsOptional()
  @IsEnum(IntercityTripStatus)
  status?: IntercityTripStatus;

  @ApiPropertyOptional({ example: '2026-10-18', description: "Jo'nash kuni (Toshkent)" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
