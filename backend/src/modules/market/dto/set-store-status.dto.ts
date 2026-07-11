import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { StoreStatus } from '../../../database/entities/store.entity';

export class SetStoreStatusDto {
  @ApiProperty({ enum: StoreStatus })
  @IsEnum(StoreStatus)
  status: StoreStatus;
}
