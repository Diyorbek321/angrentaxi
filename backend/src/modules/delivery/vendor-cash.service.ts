import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Global,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { Permission, User, UserRole } from '../../database/entities/user.entity';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { FoodOrder, FoodPaymentMethod } from '../../database/entities/food-order.entity';
import { MarketOrder, MarketPaymentMethod } from '../../database/entities/market-order.entity';
import { Restaurant } from '../../database/entities/restaurant.entity';
import { Store } from '../../database/entities/store.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RealtimeModule } from '../realtime/realtime.module';
import { VendorCashColumns } from './vendor-cash';
import { ResolveCashDisputeDto } from './dto/resolve-cash-dispute.dto';

export type VendorKind = 'food' | 'market';

/** Menejer ko'radigan ochiq nizo: sotuvchi "kuryerdan pul olmadim" degan. */
export interface VendorCashDispute {
  kind: VendorKind;
  vendorOrderId: string;
  vendorName: string;
  vendorPhone: string | null;
  amount: number;
  courierPaidAt: string | null;
  disputedAt: string;
  deliveryOrderId: string | null;
}

interface VendorOrderRef {
  kind: VendorKind;
  order: (FoodOrder | MarketOrder) & VendorCashColumns;
  ownerUserId: string;
  vendorName: string;
}

/**
 * Naqd buyurtmada kuryer → do'kon to'lovi (qoidalar `vendor-cash.ts` da).
 *
 * Global modulda, chunki uni ikki tomon ishlatadi: buyurtmalar moduli
 * (kuryer "to'ladim", safarni boshlash sharti) va ovqat/market modullari
 * (sotuvchi "oldim/olmadim"). Bu modullar bir-birini import qilsa aylanma
 * bog'liqlik bo'lardi.
 */
@Injectable()
export class VendorCashService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(FoodOrder) private readonly foodOrderRepo: Repository<FoodOrder>,
    @InjectRepository(MarketOrder) private readonly marketOrderRepo: Repository<MarketOrder>,
    @InjectRepository(Restaurant) private readonly restaurantRepo: Repository<Restaurant>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /** Kuryer do'konga tovar pulini to'ladi. */
  async markPaidByCourier(courierUserId: string, rideId: string): Promise<{ amount: number }> {
    const ride = await this.orderRepo.findOne({ where: { id: rideId } });
    if (!ride) throw new NotFoundException('Buyurtma topilmadi');
    if (ride.driverId !== courierUserId) {
      throw new ForbiddenException('Bu yetkazish sizga biriktirilmagan');
    }
    const amount = payVendorOf(ride);
    if (amount <= 0) {
      throw new BadRequestException("Bu buyurtmada do'konga to'lanadigan naqd pul yo'q");
    }
    if (ride.status !== OrderStatus.ACCEPTED && ride.status !== OrderStatus.ARRIVED) {
      throw new BadRequestException("To'lovni tovar olinguncha belgilash mumkin");
    }

    const ref = await this.vendorOrderOf(ride);
    if (!ref) throw new NotFoundException("Do'kon buyurtmasi topilmadi");
    if (!ref.order.vendorCashPaidAt) {
      await this.repoFor(ref.kind).update(ref.order.id, { vendorCashPaidAt: new Date() });
    }

    this.realtimeGateway.emitToUser(ref.ownerUserId, 'vendor:cash_paid', {
      kind: ref.kind,
      vendorOrderId: ref.order.id,
      amount,
    });
    return { amount };
  }

  /**
   * Safar (tovarni olib ketish) boshlanishidan oldin: naqd buyurtmada kuryer
   * do'konga to'lagan bo'lishi SHART. Aks holda sotuvchi pulsiz qoladi va bu
   * faqat oxirida — nizoda — ma'lum bo'lardi.
   */
  async assertReadyForPickup(ride: Order): Promise<void> {
    if (payVendorOf(ride) <= 0) return;
    const ref = await this.vendorOrderOf(ride);
    if (ref && !ref.order.vendorCashPaidAt) {
      throw new BadRequestException(
        `Avval do'konga ${formatSom(payVendorOf(ride))} so'm to'lang va "To'ladim" ni bosing`,
      );
    }
  }

  /** Sotuvchi: "kuryerdan pul oldim" (true) yoki "olmadim" (false — nizo). */
  async vendorDecision(
    ownerUserId: string,
    kind: VendorKind,
    vendorOrderId: string,
    received: boolean,
  ): Promise<void> {
    const ref = await this.loadVendorOrder(kind, vendorOrderId);
    if (!ref) throw new NotFoundException('Buyurtma topilmadi');
    if (ref.ownerUserId !== ownerUserId) {
      throw new ForbiddenException('Bu buyurtma sizning do‘koningizniki emas');
    }
    if (!ref.order.vendorCashPaidAt) {
      throw new BadRequestException("Kuryer hali to'lovni belgilamagan");
    }
    if (ref.order.vendorCashConfirmedAt || ref.order.vendorCashDisputedAt) {
      throw new BadRequestException('Qaror allaqachon qabul qilingan');
    }

    const now = new Date();
    if (received) {
      await this.repoFor(kind).update(ref.order.id, { vendorCashConfirmedAt: now });
      return;
    }
    await this.repoFor(kind).update(ref.order.id, { vendorCashDisputedAt: now });
    this.realtimeGateway.emitToManagers('delivery:cash_dispute', {
      kind,
      vendorOrderId: ref.order.id,
      vendorName: ref.vendorName,
    });
  }

  /**
   * Dispetcher nizoni yopadi — odatda ikki tomonga qo'ng'iroq qilib
   * aniqlagandan keyin. [resolution] majburiy: "hal qilindi" degan belgi
   * qanday hal bo'lganini aytmasa, keyingi nizoda unga suyanib bo'lmaydi.
   *
   * Yozuv shartli (`resolvedAt IS NULL`): ikki dispetcher bir vaqtda bossa,
   * ikkinchisi birinchisining izohini ustidan yozmaydi.
   */
  async resolveDispute(
    managerUserId: string,
    kind: VendorKind,
    vendorOrderId: string,
    resolution: string,
  ): Promise<void> {
    const note = resolution.trim();
    if (!note) throw new BadRequestException('Nizo qanday hal qilinganini yozing');

    const ref = await this.loadVendorOrder(kind, vendorOrderId);
    if (!ref) throw new NotFoundException('Buyurtma topilmadi');
    if (!ref.order.vendorCashDisputedAt) {
      throw new BadRequestException("Bu buyurtmada nizo yo'q");
    }

    const result = await this.repoFor(kind).update(
      { id: ref.order.id, vendorCashDisputeResolvedAt: IsNull() },
      {
        vendorCashDisputeResolvedAt: new Date(),
        vendorCashDisputeResolvedBy: managerUserId,
        vendorCashDisputeResolution: note,
      },
    );
    if (!result.affected) {
      throw new ConflictException('Nizo allaqachon hal qilingan');
    }

    this.realtimeGateway.emitToManagers('delivery:cash_dispute_resolved', {
      kind,
      vendorOrderId: ref.order.id,
    });
    this.realtimeGateway.emitToUser(ref.ownerUserId, 'vendor:cash_dispute_resolved', {
      kind,
      vendorOrderId: ref.order.id,
      resolution: note,
    });
  }

  /** Dispetcher navbati: sotuvchi "pul olmadim" degan, hali YOPILMAGAN buyurtmalar. */
  async listDisputes(): Promise<VendorCashDispute[]> {
    const where = { vendorCashDisputedAt: Not(IsNull()), vendorCashDisputeResolvedAt: IsNull() };
    const [food, market] = await Promise.all([
      this.foodOrderRepo.find({ where, relations: ['restaurant'], order: { vendorCashDisputedAt: 'DESC' }, take: 100 }),
      this.marketOrderRepo.find({ where, relations: ['store'], order: { vendorCashDisputedAt: 'DESC' }, take: 100 }),
    ]);
    const toEntry = (
      kind: VendorKind,
      o: (FoodOrder | MarketOrder) & VendorCashColumns,
      vendor: { name: string; phone?: string | null } | undefined,
    ): VendorCashDispute => ({
      kind,
      vendorOrderId: o.id,
      vendorName: vendor?.name ?? '—',
      vendorPhone: vendor?.phone ?? null,
      amount: goodsTotal(o),
      courierPaidAt: o.vendorCashPaidAt?.toISOString() ?? null,
      disputedAt: (o.vendorCashDisputedAt as Date).toISOString(),
      deliveryOrderId: o.deliveryOrderId ?? null,
    });
    return [
      ...food.map((o) => toEntry('food', o, o.restaurant)),
      ...market.map((o) => toEntry('market', o, o.store)),
    ].sort((a, b) => b.disputedAt.localeCompare(a.disputedAt));
  }

  private repoFor(kind: VendorKind): Repository<FoodOrder | MarketOrder> {
    return (kind === 'food' ? this.foodOrderRepo : this.marketOrderRepo) as Repository<FoodOrder | MarketOrder>;
  }

  private async vendorOrderOf(ride: Order): Promise<VendorOrderRef | null> {
    const details = ride.details ?? {};
    if (typeof details.foodOrderId === 'string') return this.loadVendorOrder('food', details.foodOrderId);
    if (typeof details.marketOrderId === 'string') return this.loadVendorOrder('market', details.marketOrderId);
    return null;
  }

  private async loadVendorOrder(kind: VendorKind, id: string): Promise<VendorOrderRef | null> {
    if (kind === 'food') {
      const order = await this.foodOrderRepo.findOne({ where: { id } });
      if (!order || order.paymentMethod !== FoodPaymentMethod.CASH) return null;
      const restaurant = await this.restaurantRepo.findOne({ where: { id: order.restaurantId } });
      return restaurant ? { kind, order, ownerUserId: restaurant.ownerUserId, vendorName: restaurant.name } : null;
    }
    const order = await this.marketOrderRepo.findOne({ where: { id } });
    if (!order || order.paymentMethod !== MarketPaymentMethod.CASH) return null;
    const store = await this.storeRepo.findOne({ where: { id: order.storeId } });
    return store ? { kind, order, ownerUserId: store.ownerUserId, vendorName: store.name } : null;
  }
}

/** Kuryer do'konga to'laydigan summa (`DeliveryRideDetails.payVendor`). */
function payVendorOf(ride: Pick<Order, 'details'>): number {
  const value = (ride.details as Record<string, unknown> | null)?.payVendor;
  return typeof value === 'number' && value > 0 ? value : 0;
}

/** Tovar summasi = jami − yetkazish; nizo kartasida ko'rsatiladi. */
function goodsTotal(o: { items: ReadonlyArray<{ qty: number; price: number }> }): number {
  return Math.round(o.items.reduce((sum, i) => sum + i.qty * Number(i.price), 0));
}

function formatSom(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Dispetcher: sotuvchi "kuryerdan pul olmadim" degan buyurtmalar. */
@ApiTags('Delivery')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('delivery')
export class VendorCashController {
  constructor(private readonly vendorCash: VendorCashService) {}

  @Get('cash-disputes')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: "Naqd nizolar: sotuvchi kuryerdan tovar pulini olmagan" })
  listDisputes(): Promise<VendorCashDispute[]> {
    return this.vendorCash.listDisputes();
  }

  @Post('cash-disputes/:kind/:id/resolve')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @RequirePermissions(Permission.DISPATCH)
  @ApiOperation({ summary: 'Naqd nizoni yopish (izoh bilan)' })
  async resolveDispute(
    @CurrentUser() user: User,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveCashDisputeDto,
  ): Promise<{ resolved: true }> {
    if (kind !== 'food' && kind !== 'market') {
      throw new BadRequestException("Noto'g'ri buyurtma turi");
    }
    await this.vendorCash.resolveDispute(user.id, kind, id, dto.resolution);
    return { resolved: true };
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Order, FoodOrder, MarketOrder, Restaurant, Store]), RealtimeModule],
  controllers: [VendorCashController],
  providers: [VendorCashService],
  exports: [VendorCashService],
})
export class VendorCashModule {}
