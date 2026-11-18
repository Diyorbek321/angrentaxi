import { Module } from '@nestjs/common';
import { VendorTinService } from './vendor-tin.service';

/**
 * Admin: restoran/do'kon STIR'i. Faqat DataSource va global `AuditModule` ga
 * tayanadi — Food/Market modullari import qiladi, aylanma bog'liqlik yo'q.
 */
@Module({
  providers: [VendorTinService],
  exports: [VendorTinService],
})
export class VendorTinModule {}
