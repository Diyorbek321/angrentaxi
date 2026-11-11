import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripTrackPoint } from '../../database/entities/trip-track-point.entity';
import { RoutingModule } from '../routing/routing.module';
import { TaximeterService } from './taximeter.service';

// Faqat o'z jadvali va OSRM'ga bog'liq — Drivers ham, Orders ham bemalol
// import qiladi (TaximeterService izohiga qarang).
@Module({
  imports: [TypeOrmModule.forFeature([TripTrackPoint]), RoutingModule],
  providers: [TaximeterService],
  exports: [TaximeterService],
})
export class TaximeterModule {}
