import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LegalAcceptance } from '../../database/entities/legal-acceptance.entity';
import { AdminLegalController, LegalAcceptanceController } from './legal-acceptance.controller';
import { LegalAcceptanceService } from './legal-acceptance.service';

/**
 * Oferta roziligi. Faqat TypeORM'ga tayanadi — DriversModule uni aylanma
 * bog'liqliksiz import qiladi (onlayn chiqish darvozasi).
 */
@Module({
  imports: [TypeOrmModule.forFeature([LegalAcceptance])],
  controllers: [LegalAcceptanceController, AdminLegalController],
  providers: [LegalAcceptanceService],
  exports: [LegalAcceptanceService],
})
export class LegalModule {}
