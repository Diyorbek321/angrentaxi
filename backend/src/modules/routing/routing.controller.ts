import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Coordinate, DrivingRoute, OsrmService } from './osrm.service';
import { RouteQueryDto } from './dto/route-query.dto';

/** Parses `lng,lat;lng,lat` and rejects out-of-range pairs. */
export function parseRouteCoords(raw: string): Coordinate[] {
  return raw.split(';').map((pair) => {
    const [lng, lat] = pair.split(',').map(Number);
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new BadRequestException(`Coordinate out of range: ${pair}`);
    }
    return [lng, lat] as const;
  });
}

/**
 * Road routes for the apps (route line on the tariff screen, in-app driver
 * navigation). Any signed-in user may ask: a passenger needs it before an
 * order exists, so it cannot be tied to one.
 */
@ApiTags('Routing')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('routing')
export class RoutingController {
  constructor(private readonly osrmService: OsrmService) {}

  // Navigation re-routes on deviation and the tariff screen re-routes when a
  // stop changes, so 30/min per user is generous for a person and still caps
  // a scripted client well below what would hurt the OSRM box.
  @Get('route')
  @Throttle({ long: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Driving route with geometry and turn-by-turn steps' })
  @ApiOkResponse({ description: 'OSRM-shaped route: distance, duration, geometry, legs' })
  async route(@Query() query: RouteQueryDto): Promise<DrivingRoute> {
    const route = await this.osrmService.route(parseRouteCoords(query.coords));
    if (!route) {
      // 404, not 502: to the app both mean "draw a straight line", and a
      // point off the road network is the common case, not an outage.
      throw new NotFoundException('No route found');
    }
    return route;
  }
}
