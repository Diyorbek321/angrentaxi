import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { TripShareLink } from '../../database/entities/trip-share-link.entity';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import { DriversService } from '../drivers/drivers.service';
import { SettingsService } from '../settings/settings.service';
import {
  hashShareToken,
  isShareableStatus,
  isShareLinkExpired,
  isWellFormedShareToken,
  newShareToken,
  PublicTripView,
  publicDriverName,
  shareLinkExpiresAt,
  TRIP_SHARE_MAX_LINKS_PER_ORDER,
} from './trip-share-policy';

export interface CreatedShareLink {
  /** Faqat shu javobda — bazada xeshi. */
  token: string;
  /** API asosiga nisbatan yo'l: `${apiBaseUrl}${path}`. */
  path: string;
}

/**
 * "Safarni ulashish" (INCIDENT-POLICY §4): yo'lovchi yaqiniga havola
 * yuboradi, u brauzerda haydovchi ismi, mashina, joriy joylashuv va
 * holatni ko'radi. Telefon raqamlari va olish manzili YO'Q.
 */
@Injectable()
export class TripShareService {
  constructor(
    @InjectRepository(TripShareLink) private readonly links: Repository<TripShareLink>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly driversService: DriversService,
    private readonly settingsService: SettingsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(orderId: string, userId: string): Promise<CreatedShareLink> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    if (order.passengerId !== userId) throw new ForbiddenException('Siz bu buyurtma ishtirokchisi emassiz');
    if (!order.driverId || !isShareableStatus(order.status)) {
      throw new BadRequestException("Safarni haydovchi biriktirilgandan keyin va tugaguncha ulashish mumkin");
    }
    const existing = await this.links.count({ where: { orderId } });
    if (existing >= TRIP_SHARE_MAX_LINKS_PER_ORDER) {
      throw new BadRequestException('Bu safar uchun havolalar soni chegarasiga yetdi');
    }

    const token = newShareToken();
    await this.links.manager.transaction(async (manager) => {
      const link = await manager.save(
        TripShareLink,
        manager.create(TripShareLink, { orderId, tokenHash: hashShareToken(token), createdBy: userId }),
      );
      await this.auditLog.record(
        {
          actorUserId: userId,
          action: AUDIT_ACTIONS.tripShareCreate,
          targetType: 'order',
          targetId: orderId,
          metadata: { linkId: link.id },
        },
        manager,
      );
    });
    return { token, path: `/share/${token}` };
  }

  /** Ommaviy ko'rinish. Topilmasa 404, muddati o'tgan bo'lsa 410. */
  async view(token: string, now: Date = new Date()): Promise<PublicTripView> {
    if (!isWellFormedShareToken(token)) throw new NotFoundException('Havola topilmadi');
    const link = await this.links.findOne({ where: { tokenHash: hashShareToken(token) } });
    if (!link || link.revokedAt) throw new NotFoundException('Havola topilmadi');

    const order = await this.orders.findOne({ where: { id: link.orderId }, relations: ['driver'] });
    if (!order) throw new NotFoundException('Havola topilmadi');

    const { tripShareGraceMinutes } = await this.settingsService.getSafetyPolicySettings();
    if (isShareLinkExpired(order, tripShareGraceMinutes, now)) {
      throw new GoneException('Havola muddati tugagan');
    }

    const active = isShareableStatus(order.status);
    const [profile, location] = await Promise.all([
      order.driverId ? this.driversService.findByUserId(order.driverId) : Promise.resolve(null),
      active && order.driverId ? this.driversService.getLastLocationByUserId(order.driverId) : Promise.resolve(null),
    ]);
    const expiresAt = shareLinkExpiresAt(order, tripShareGraceMinutes);

    return {
      status: order.status,
      driverName: publicDriverName(order.driver?.firstName, order.driver?.lastName),
      carModel: profile?.carModel ?? null,
      carNumber: profile?.carNumber ?? null,
      dropoffAddress: order.dropoffAddress ?? null,
      location,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    };
  }
}
