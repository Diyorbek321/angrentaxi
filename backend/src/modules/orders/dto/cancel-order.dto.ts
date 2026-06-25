import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({ example: 'Driver taking too long', description: 'Cancellation reason' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
