import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Feature switch for pricing a finished ride by road distance instead of the
 * straight line between its ordered points.
 *
 * It exists as an explicit flag because flipping it reprices every trip: real
 * road distance in a street grid runs meaningfully longer than the straight
 * line, so fares rise and driver earnings rise with them. That is the more
 * honest number — the driver really did drive it — but it is the operator's
 * call when to make it live, not something a deploy should do quietly.
 *
 * Enable with `ROUTED_DISTANCE_PRICING=true` once a handful of real trips have
 * been compared both ways (the completion log prints both figures).
 *
 * Requires a working OSRM endpoint (see OSRM_URL); with none, pricing silently
 * stays on the straight-line measure.
 */
@Injectable()
export class RoutedDistancePricing {
  readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('ROUTED_DISTANCE_PRICING') === 'true';
  }
}
