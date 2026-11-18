import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { Rating } from '../../database/entities/rating.entity';
import { Order } from '../../database/entities/order.entity';
import { IncidentSignalsModule } from '../incidents/incident-signals.module';

@Module({
  imports: [TypeOrmModule.forFeature([Rating, Order]), IncidentSignalsModule],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
