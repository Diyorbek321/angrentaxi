import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateCommissionDto {
  @ApiProperty({ example: 10, description: 'Default platform commission rate, in percent' })
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultCommissionRate: number;
}
