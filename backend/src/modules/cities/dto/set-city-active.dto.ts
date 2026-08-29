import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetCityActiveDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive: boolean;
}
