import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateDriverDto {
  @ApiPropertyOptional({ example: 'Toyota Camry', description: 'Car model' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  carModel?: string;

  @ApiPropertyOptional({ example: '01 A 123 BC', description: 'Car number' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  carNumber?: string;

  @ApiPropertyOptional({ example: '01A123BC', description: 'License plate' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  licensePlate?: string;

  @ApiPropertyOptional({
    example: 2019,
    description: "Car manufacture year — informs the manager's tariff-tier review",
  })
  @IsOptional()
  @IsInt()
  @Min(1990)
  @Max(new Date().getFullYear() + 1)
  carYear?: number;
}
