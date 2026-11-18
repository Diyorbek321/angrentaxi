import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { SurgeLevel, SurgeService } from './surge.service';
import { SurgeZonesQueryDto } from './dto/surge-zones-query.dto';

/** What the app reads off each hexagon. */
export interface SurgeZoneProperties {
  /** H3 index — the stable key the client uses to diff a redrawn map. */
  zone: string;
  /** The only surge fact the driver is shown; see SurgeLevel. */
  level: SurgeLevel;
  /**
   * Kept in the payload for logs and analytics — correlating "what the map
   * said" with "what the driver earned" is impossible from a bucket alone —
   * but deliberately not rendered. See SurgeLevel for why.
   */
  multiplier: number;
}

export interface SurgeZoneFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    /** One linear ring of [lng, lat] pairs, per the GeoJSON spec. */
    coordinates: [number, number][][];
  };
  properties: SurgeZoneProperties;
}

export interface SurgeZonesFeatureCollection {
  type: 'FeatureCollection';
  features: SurgeZoneFeature[];
}

/**
 * The driver-facing demand map.
 *
 * Shaped as GeoJSON rather than a list of zones because MapLibre consumes a
 * FeatureCollection directly as a source: any other shape would need the app
 * to rebuild polygons on the UI thread every refresh.
 *
 * Note what actually goes over the wire. The global ResponseInterceptor wraps
 * every response, so the client receives
 * `{ success: true, data: { type: 'FeatureCollection', ... } }` — never a bare
 * FeatureCollection. The app therefore has to unwrap `data` before handing the
 * value to the map; that unwrap is load-bearing, not defensive. Anyone who
 * exempts this route from the interceptor must delete the unwrap in the same
 * change, and vice versa.
 */
@ApiTags('Surge')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('surge')
export class SurgeController {
  constructor(private readonly surgeService: SurgeService) {}

  // Drivers only. The map answers "where should I drive", which is a driver's
  // question; the same picture in a passenger's hands is a price map they can
  // wait out or walk out of, and it would leak where the city's drivers are.
  @Get('zones')
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary: 'Demand map around a point, as GeoJSON hexagons (drivers only)',
  })
  @ApiOkResponse({
    description:
      'FeatureCollection of H3 hexagons, each carrying its surge level',
  })
  async zones(
    @Query() query: SurgeZonesQueryDto,
  ): Promise<SurgeZonesFeatureCollection> {
    const zones = await this.surgeService.zonesAround(
      query.lat,
      query.lng,
      query.rings ?? SurgeService.DEFAULT_MAP_RINGS,
    );

    // An empty features array is a valid FeatureCollection, so a failed or
    // empty read clears the map instead of breaking the source binding.
    return {
      type: 'FeatureCollection',
      features: zones.map((zone) => ({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [zone.boundary],
        },
        properties: {
          zone: zone.zone,
          level: SurgeService.levelFor(zone.multiplier),
          multiplier: zone.multiplier,
        },
      })),
    };
  }
}
