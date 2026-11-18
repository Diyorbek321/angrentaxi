import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateIntercitySettingsDto {
  @ApiPropertyOptional({ description: "Shaharlararo qatnovni yoqish/o'chirish" })
  @IsOptional()
  @IsBoolean()
  intercityEnabled?: boolean;

  // 0 — bepul bekor qilish yo'q; 24 soatdan ko'pi ma'nosiz (qatnov
  // odatda bir-ikki kun oldin e'lon qilinadi).
  @ApiPropertyOptional({ example: 60, description: "Jo'nashdan necha daqiqa oldingacha bekor qilish bepul" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  intercityFreeCancelMinutes?: number;

  // 8 — `intercity_trips.seats_total` chegarasi (CHECK).
  @ApiPropertyOptional({ example: 4, description: "Bitta bandda ko'pi bilan nechta o'rindiq" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  intercityMaxSeatsPerBooking?: number;

  @ApiPropertyOptional({ example: 30, description: "Qatnov kamida necha daqiqa oldin e'lon qilinadi" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  intercityMinLeadMinutes?: number;

  @ApiPropertyOptional({ example: 7, description: "Ko'pi bilan necha kun oldinga e'lon qilinadi" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  intercityMaxAheadDays?: number;

  // 0 — tekshiruv o'chiq; 2 soatdan ko'pi tekshiruvni ma'nosiz qiladi.
  @ApiPropertyOptional({ example: 15, description: "O'rindiq bandi shahar ichidagi yo'lni ko'pi bilan necha daqiqa uzaytiradi (0 — o'chiq)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  intercityMaxDetourMinutes?: number;
}
