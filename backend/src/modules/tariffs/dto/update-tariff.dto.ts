import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTariffDto {
  @ApiPropertyOptional({ example: 'Standard', description: 'Tariff name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 3000, description: 'Base price in UZS' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({ example: 1500, description: 'Price per kilometer in UZS' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKm?: number;

  @ApiPropertyOptional({ example: 200, description: 'Price per minute in UZS' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerMin?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Minimum price in UZS' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    example: 50000,
    description: 'Maximum price in UZS (unbounded if omitted)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ example: true, description: 'Whether tariff is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
