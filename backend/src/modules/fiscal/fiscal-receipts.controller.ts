import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { FiscalReceiptsService } from './fiscal-receipts.service';
import { FiscalReceiptQueryDto } from './dto/fiscal-receipt-query.dto';

/** Fiskal cheklar navbati — faqat admin (docs/LEGAL-COMPLIANCE.md). */
@ApiTags('Fiscal receipts (admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/fiscal-receipts')
export class FiscalReceiptsController {
  constructor(private readonly fiscalReceipts: FiscalReceiptsService) {}

  @Get()
  @ApiOperation({ summary: 'List fiscal receipts with filters + counts by status (admin only)' })
  list(@Query() query: FiscalReceiptQueryDto) {
    return this.fiscalReceipts.list({
      status: query.status,
      serviceType: query.serviceType,
      principalType: query.principalType,
      orderId: query.orderId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  // Literal yo'l `:id/retry` dan oldin — aniq marshrut birinchi.
  @Post('retry-pending')
  @ApiOperation({ summary: "Retry every failed/pending receipt (oldest first, up to 50)" })
  retryPending() {
    return this.fiscalReceipts.retryPending();
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry one failed/pending receipt' })
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.fiscalReceipts.retry(id);
  }
}
