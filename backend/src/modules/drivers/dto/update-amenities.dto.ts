import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn } from 'class-validator';
import { TRIP_OPTION_VALUES, TripOption } from '../../orders/trip-options';

/** The full list the driver offers; an empty list clears it. */
export class UpdateAmenitiesDto {
  @ApiProperty({ enum: TripOption, isArray: true, example: ['child_seat', 'air_conditioner'] })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(TRIP_OPTION_VALUES.length)
  @IsIn(TRIP_OPTION_VALUES, { each: true })
  amenities: TripOption[];
}
