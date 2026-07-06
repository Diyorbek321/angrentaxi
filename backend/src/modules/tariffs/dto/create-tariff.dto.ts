import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateTariffDto {
  @ApiProperty({ example: 'Standard', description: 'Tariff name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 3000, description: 'Base price in UZS' })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({ example: 1500, description: 'Price per kilometer in UZS' })
  @IsNumber()
  @Min(0)
  pricePerKm: number;

  @ApiProperty({ example: 200, description: 'Price per minute in UZS' })
  @IsNumber()
  @Min(0)
  pricePerMin: number;

  @ApiProperty({ example: 5000, description: 'Minimum price in UZS' })
  @IsNumber()
  @Min(0)
  minPrice: number;

  @ApiProperty({
    example: 50000,
    description: 'Maximum price in UZS (unbounded if omitted)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiProperty({ example: true, description: 'Whether tariff is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
