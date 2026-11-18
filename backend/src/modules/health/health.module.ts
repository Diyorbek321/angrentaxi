import { Module } from '@nestjs/common';
import { DriversModule } from '../drivers/drivers.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

// REDIS_CLIENT DriversModule'dan olinadi — alohida ulanish ochilmaydi.
@Module({
  imports: [DriversModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
