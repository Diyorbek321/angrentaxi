import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../database/entities/order.entity';
import { TaxWithholdingController } from './tax-withholding.controller';
import { TaxWithholdingReportService } from './tax-withholding-report.service';

/**
 * Soliq agenti hisoboti. Ushlab qolishning O'ZI `OrdersCompletionService`
 * da (komissiya bilan bir tranzaksiyada); bu modul faqat o'qiydi.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  controllers: [TaxWithholdingController],
  providers: [TaxWithholdingReportService],
})
export class TaxModule {}
