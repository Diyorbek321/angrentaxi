import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromoCodesController } from './promo-codes.controller';
import { PromoCodesService } from './promo-codes.service';
import { PromoCode } from '../../database/entities/promo_code.entity';
import { PromoCodeUsage } from '../../database/entities/promo_code_usage.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PromoCode, PromoCodeUsage])],
  controllers: [PromoCodesController],
  providers: [PromoCodesService],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}
