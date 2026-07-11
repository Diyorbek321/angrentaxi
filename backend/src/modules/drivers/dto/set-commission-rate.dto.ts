import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SetCommissionRateDto {
  @ApiPropertyOptional({
    example: 5,
    description: 'Override commission rate in percent; omit/null to use the platform default',
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number | null;
}
