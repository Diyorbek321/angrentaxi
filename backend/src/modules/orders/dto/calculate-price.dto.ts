import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';

export class CalculatePriceDto {
  @ApiProperty({ example: 'uuid', description: 'Tariff ID' })
  @IsUUID()
  tariffId: string;

  @ApiProperty({ example: 5.2, description: 'Estimated distance in kilometers' })
  @IsNumber()
  @Min(0.1)
  @Max(500)
  distanceKm: number;

  @ApiProperty({ example: 12, description: 'Estimated duration in minutes' })
  @IsNumber()
  @Min(1)
  @Max(300)
  durationMin: number;
}
