import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class SetTariffTierDto {
  @ApiProperty({
    example: 3,
    description: 'Highest Tariff.tier (1 = Start ... 5 = Biznes) this driver may be matched against',
  })
  @IsInt()
  @Min(1)
  @Max(5)
  tier: number;
}
