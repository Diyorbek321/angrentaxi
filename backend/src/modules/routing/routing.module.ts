import { Module } from '@nestjs/common';
import { OsrmService } from './osrm.service';
import { RoutingController } from './routing.controller';

/**
 * Routing lives in its own module so both dispatch (ETA-ranked matching) and
 * trip completion (snap-to-road distance) share one OSRM client and one
 * configured endpoint.
 */
@Module({
  controllers: [RoutingController],
  providers: [OsrmService],
  exports: [OsrmService],
})
export class RoutingModule {}
