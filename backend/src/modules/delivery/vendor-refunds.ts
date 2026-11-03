import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Optional,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import { FoodOrder } from '../../database/entities/food-order.entity';
import { MarketOrder } from '../../database/entities/market-order.entity';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import { RefundDoneDto } from '../orders/dto/delivery-incident.dto';

/** Menejer navbati: qaytarilgan kartali buyurtma — mijozga qo'lda qaytariladigan summa. */
export interface PendingVendorRefund {
  kind: 'food' | 'market';
  vendorOrderId: string;
  vendorName: string;
  vendorPhone: string | null;
  /** Kuryer safari — menejer iz va chekni ko'radi. */
  deliveryOrderId: string | null;
  customerPhone: string | null;
  totalPrice: number;
  returnCharge: number;
  refundDue: number;
  returnedAt: string | null;
}

const PENDING_LIMIT = 100;

/**
 * Kartali qaytarishlar (docs/INCIDENT-POLICY.md §2). Karta qaytarish API'si
 * yo'q — summa `refund_due` da, menejer provayder kabinetidan qaytaradi va
 * shu yerda "bajarildi" deb belgilaydi (audit, bir marta).
 */
@Injectable()
export class VendorRefundsService {
  constructor(
    @InjectRepository(FoodOrder) private readonly foodOrderRepo: Repository<FoodOrder>,
    @InjectRepository(MarketOrder) private readonly marketOrderRepo: Repository<MarketOrder>,
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

  async listPending(): Promise<PendingVendorRefund[]> {
    const where = { refundStatus: 'pending' as const };
    const [food, market] = await Promise.all([
      this.foodOrderRepo.find({ where, relations: ['restaurant'], order: { returnedAt: 'ASC' }, take: PENDING_LIMIT }),
      this.marketOrderRepo.find({ where, relations: ['store'], order: { returnedAt: 'ASC' }, take: PENDING_LIMIT }),
    ]);
    const entry = (
      kind: 'food' | 'market',
      o: FoodOrder | MarketOrder,
      vendor: { name: string; phone?: string | null } | undefined,
    ): PendingVendorRefund => ({
      kind,
      vendorOrderId: o.id,
      vendorName: vendor?.name ?? '—',
      vendorPhone: vendor?.phone ?? null,
      deliveryOrderId: o.deliveryOrderId ?? null,
      customerPhone: o.customerPhone ?? null,
      totalPrice: Number(o.totalPrice),
      returnCharge: Number(o.returnCharge ?? 0),
      refundDue: Number(o.refundDue ?? 0),
      returnedAt: o.returnedAt ? new Date(o.returnedAt).toISOString() : null,
    });
    return [
      ...food.map((o) => entry('food', o, o.restaurant)),
      ...market.map((o) => entry('market', o, o.store)),
    ].sort((a, b) => (a.returnedAt ?? '').localeCompare(b.returnedAt ?? ''));
  }

  async markDone(managerUserId: string, kind: string, id: string, note?: string): Promise<void> {
    if (kind !== 'food' && kind !== 'market') throw new BadRequestException("Noto'g'ri buyurtma turi");
    const repo = (kind === 'food' ? this.foodOrderRepo : this.marketOrderRepo) as Repository<FoodOrder | MarketOrder>;
    const order = await repo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    const result = await repo.update({ id, refundStatus: 'pending' }, { refundStatus: 'done' });
    if (!result.affected) throw new ConflictException('Qaytarish allaqachon bajarilgan yoki kutilmayapti');
    await this.auditLog?.record({
      actorUserId: managerUserId,
      action: AUDIT_ACTIONS.deliveryRefundDone,
      targetType: `${kind}_order`,
      targetId: id,
      amount: Number(order.refundDue ?? 0),
      note: note?.trim() || null,
    });
  }
}

@ApiTags('Delivery')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('delivery')
export class VendorRefundsController {
  constructor(private readonly refunds: VendorRefundsService) {}

  @Get('refunds-pending')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: "Qaytarilgan kartali buyurtmalar — mijozga qo'lda qaytariladigan summa" })
  listPending(): Promise<PendingVendorRefund[]> {
    return this.refunds.listPending();
  }

  @Post('refunds/:kind/:id/done')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: 'Qaytarish bajarildi (audit)' })
  async markDone(
    @CurrentUser() user: User,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundDoneDto,
  ): Promise<{ done: true }> {
    await this.refunds.markDone(user.id, kind, id, dto.note);
    return { done: true };
  }
}
