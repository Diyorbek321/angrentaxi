import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RestaurantStatus } from '../../../database/entities/restaurant.entity';

export class SetRestaurantStatusDto {
  @ApiProperty({ enum: RestaurantStatus })
  @IsEnum(RestaurantStatus)
  status: RestaurantStatus;
}
