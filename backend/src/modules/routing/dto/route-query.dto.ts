import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * `coords` is OSRM's own `lng,lat;lng,lat;...` syntax: the first pair is the
 * start, the last is the end, anything between is a stop visited in order.
 *
 * 2..10 points. Ten covers pickup + the multi-stop limit with room to spare;
 * an unbounded list would let one request make OSRM route across the country
 * a hundred times.
 */
const PAIR = '-?\\d{1,3}(?:\\.\\d+)?,-?\\d{1,2}(?:\\.\\d+)?';
export const ROUTE_COORDS_PATTERN = new RegExp(`^${PAIR}(?:;${PAIR}){1,9}$`);

export class RouteQueryDto {
  @ApiProperty({
    example: '70.0795,41.0212;70.1001,41.0305',
    description: 'lng,lat pairs separated by ";" (2 to 10 points)',
  })
  @Matches(ROUTE_COORDS_PATTERN, {
    message: 'coords must be 2-10 "lng,lat" pairs separated by ";"',
  })
  coords: string;
}
