import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

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
}
