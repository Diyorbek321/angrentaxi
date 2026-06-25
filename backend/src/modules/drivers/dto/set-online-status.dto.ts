import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetOnlineStatusDto {
  @ApiProperty({ example: true, description: 'Driver online status' })
  @IsBoolean()
  isOnline: boolean;
}
