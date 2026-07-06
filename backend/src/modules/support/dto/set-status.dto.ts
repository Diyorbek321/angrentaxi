import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SupportThreadStatus } from '../../../database/entities/support-thread.entity';

export class SetThreadStatusDto {
  @ApiProperty({ enum: SupportThreadStatus })
  @IsEnum(SupportThreadStatus)
  status: SupportThreadStatus;
}
