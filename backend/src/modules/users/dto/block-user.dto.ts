import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BlockUserDto {
  @ApiPropertyOptional({ example: 'Repeated no-shows', description: 'Reason for blocking' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
