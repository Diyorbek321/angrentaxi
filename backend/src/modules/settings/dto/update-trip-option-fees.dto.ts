import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Ruxsat etilgan eng katta opsiya haqi — xato bilan qo'shilgan nolni ushlaydi. */
export const TRIP_OPTION_FEE_MAX = 100_000;

/**
 * Kalitlar — `TripOption` xom qiymatlari. Yuborilmagan opsiya o'zgarmaydi,
 * `0` — haqi olib tashlanadi.
 */
export class UpdateTripOptionFeesDto {
  @ApiPropertyOptional({ example: 5000, description: "Bola o'rindig'i, so'm" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(TRIP_OPTION_FEE_MAX)
  child_seat?: number;

  @ApiPropertyOptional({ example: 5000, description: "Hayvon bilan, so'm" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(TRIP_OPTION_FEE_MAX)
  pet?: number;

  @ApiPropertyOptional({ example: 0, description: "Konditsioner, so'm" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(TRIP_OPTION_FEE_MAX)
  air_conditioner?: number;

  @ApiPropertyOptional({ example: 3000, description: "Katta bagaj, so'm" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(TRIP_OPTION_FEE_MAX)
  big_luggage?: number;
}
