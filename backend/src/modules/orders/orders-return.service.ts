// Yetkazish hodisalari (docs/INCIDENT-POLICY.md §2): manzilga yetib kelish,
// "yetkazib bo'lmadi" → qaytarish yo'li, qaytarishni tasdiqlash va
// "osilib qolgan" yetkazish signali. Holat mashinasi —
// `delivery/delivery-return.ts`; pul — `OrdersCompletionService`
// (`completeTrip(..., { returned: true })`), ya'ni qaytarilgan safar ham
// oddiy safar bilan BIR XIL hisob-kitob yo'lidan o'tadi.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DeliveryFailureReason, Order, OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { DeliveryEventsService } from '../delivery/delivery-events.service';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import { waitingSettingsOf } from '../tariffs/waiting-charge';
import { TRACKED_DELIVERY_SERVICE_TYPES } from '../taximeter/taximeter.service';
import {
  assertCanMarkDropoffArrived,
  assertCanMarkFailed,
  isHandoverRide,
  isVendorDeliveryRide,
  parseDeliveryFailureReason,
} from '../delivery/delivery-return';
import { courierAtDoorText, deliveryFailedCustomerText } from '../notifications/delivery-incident-texts';
import { OrdersQueryService } from './orders-query.service';
import { OrdersCompletionService } from './orders-completion.service';
import { ActiveDeliveryRow, StuckDelivery, stuckReasonsOf, toStuckDelivery } from './stuck-deliveries';

/** Kuryer manzildan shuncha metr ichida bo'lsa "yetib keldim" qabul qilinadi (olish nuqtasi bilan bir xil). */
const DROPOFF_GEOFENCE_METERS = 500;
const STUCK_SCAN_LIMIT = 300;

export type ReturnConfirmer =
  | { kind: 'vendor'; userId: string }
  | { kind: 'sender'; userId: string }
  | { kind: 'manager'; userId: string; note: string };

function requireNote(note: string | undefined): string {
  const clean = (note ?? '').trim();
  if (!clean) throw new BadRequestException('Izoh majburiy — nima bo‘lganini yozing');
  return clean.slice(0, 500);
}

@Injectable()
export class OrdersReturnService {
  private readonly logger = new Logger(OrdersReturnService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly queryService: OrdersQueryService,
    private readonly completionService: OrdersCompletionService,
    private readonly settingsService: SettingsService,
    private readonly realtimeGateway: RealtimeGateway,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly deliveryEvents?: DeliveryEventsService,
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

  /**
   * Kuryer topshirish manziliga yetib keldi — manzilda kutish shundan
   * boshlanadi. Bir marta yoziladi (`COALESCE`): qayta bosish kutishni
   * nolga tushirmaydi. Manzildan 500 m ichida bo'lishi shart — aks holda
   * kuryer erta bosib mijozdan kutish haqi undira olardi.
   */
  async markDropoffArrived(driverId: string, orderId: string): Promise<Order> {
    const order = await this.queryService.findByIdOrThrow(orderId);
    if (order.driverId !== driverId) {
      throw new ForbiddenException('You are not the driver for this order');
    }
    assertCanMarkDropoffArrived(order);
    await this.assertNearDropoff(driverId, orderId);

    const result = await this.orderRepository
      .createQueryBuilder()
      .update(Order)
      .set({ dropoffArrivedAt: () => 'COALESCE("dropoff_arrived_at", :arrivedAt)' })
      .where('id = :id', { id: orderId })
      .andWhere('status = :status', { status: OrderStatus.IN_PROGRESS })
      .andWhere('delivery_failed_at IS NULL')
      .setParameters({ arrivedAt: new Date() })
      .execute();
    if (!result.affected) {
      throw new BadRequestException('Manzilga yetib kelganingizni faqat yetkazish davomida belgilash mumkin');
    }

    const updated = await this.queryService.findByIdOrThrow(orderId);
    const { dropoffFreeWaitMinutes } = await this.settingsService.getDeliveryIncidentSettings();
    const { waitingPricePerMinute } = waitingSettingsOf(updated.tariff ?? {});
    this.realtimeGateway.emitToUser(updated.passengerId, 'order:dropoff_arrived', {
      orderId,
      dropoffArrivedAt: updated.dropoffArrivedAt,
      freeWaitMinutes: dropoffFreeWaitMinutes,
      waitingPricePerMinute,
    });
    this.realtimeGateway.emitToManagers('order:updated', updated);
    await this.deliveryEvents?.publish(updated, 'dropoff_arrived');
    // Posilkada qabul qiluvchi ilovada emas — push faqat ovqat/market mijoziga.
    if (isVendorDeliveryRide(updated)) {
      await this.push([updated.passengerId], (lang) => courierAtDoorText(dropoffFreeWaitMinutes, lang), 'courier_at_door', orderId);
    }
    return updated;
  }

  /**
   * "Yetkazib bo'lmadi" — safar qaytarish yo'liga o'tadi (holat
   * `in_progress` qoladi, `deliveryFailedAt` yoziladi). Kuryer faqat bepul
   * kutish tugagach; dispetcher istalgan payt, izoh bilan (audit).
   */
  async markDeliveryFailed(
    actor: { userId: string; byManager: boolean; note?: string },
    orderId: string,
    rawReason: unknown,
  ): Promise<Order> {
    const reason: DeliveryFailureReason = parseDeliveryFailureReason(rawReason);
    const note = actor.byManager ? requireNote(actor.note) : null;
    const order = await this.queryService.findByIdOrThrow(orderId);
    if (!actor.byManager && order.driverId !== actor.userId) {
      throw new ForbiddenException('You are not the driver for this order');
    }
    const { dropoffFreeWaitMinutes } = await this.settingsService.getDeliveryIncidentSettings();
    const now = new Date();
    assertCanMarkFailed(order, now, dropoffFreeWaitMinutes, actor.byManager);

    // Shartli: kuryerning "topshirdim" i bilan poygada faqat bittasi o'tadi.
    const result = await this.orderRepository.update(
      { id: orderId, status: OrderStatus.IN_PROGRESS, deliveryFailedAt: IsNull() },
      { deliveryFailedAt: now, deliveryFailureReason: reason },
    );
    if (!result.affected) {
      throw new BadRequestException('Bu yetkazish allaqachon qaytarilmoqda');
    }

    if (actor.byManager) {
      await this.audit(AUDIT_ACTIONS.deliveryMarkFailed, actor.userId, orderId, note, { reason });
    }
    this.logger.log(`Order ${orderId}: yetkazib bo'lmadi (${reason}) — qaytarish yo'li`);

    const updated = await this.queryService.findByIdOrThrow(orderId);
    this.realtimeGateway.emitToUser(updated.passengerId, 'order:delivery_failed', { orderId, reason });
    if (updated.driverId && actor.byManager) {
      this.realtimeGateway.emitToUser(updated.driverId, 'order:delivery_failed', { orderId, reason });
    }
    this.realtimeGateway.emitToManagers('order:updated', updated);
    await this.deliveryEvents?.publish(updated, 'delivery_failed', { failureReason: reason });
    await this.push([updated.passengerId], deliveryFailedCustomerText, 'delivery_failed', orderId);
    return updated;
  }

  /**
   * Tovar qaytib keldi — safar `completed` + `deliveryOutcome='returned'`
   * bo'ladi va oddiy safardek hisoblanadi (yetkazish + kutish + qaytarish
   * haqi). Kim tasdiqlaydi: ovqat/market — sotuvchi (egaligini chaqiruvchi
   * modul tekshiradi), posilka — yuboruvchining o'zi, har qanday — dispetcher
   * (izoh majburiy, audit). Kuryer O'ZI tasdiqlay olmaydi: aks holda tovarni
   * qaytarmasdan qaytarish haqini olishi mumkin edi.
   */
  async confirmReturned(orderId: string, actor: ReturnConfirmer): Promise<Order> {
    const note = actor.kind === 'manager' ? requireNote(actor.note) : null;
    const order = await this.queryService.findByIdOrThrow(orderId);
    if (!isHandoverRide(order)) {
      throw new BadRequestException("Bu buyurtmada qaytarish yo'q");
    }
    if (actor.kind === 'sender' && (order.passengerId !== actor.userId || order.serviceType !== ServiceType.PARCEL)) {
      throw new ForbiddenException('Qaytarishni faqat posilka yuboruvchisi tasdiqlaydi');
    }
    if (actor.kind === 'vendor' && !isVendorDeliveryRide(order)) {
      throw new ForbiddenException('Bu buyurtma sotuvchiniki emas');
    }
    if (order.status !== OrderStatus.IN_PROGRESS || !order.deliveryFailedAt) {
      throw new BadRequestException('Bu buyurtma qaytarilmayapti');
    }
    if (!order.driverId) {
      throw new BadRequestException('Order has no driver to complete it for');
    }

    const completed = await this.completionService.completeTrip(order.driverId, orderId, undefined, {
      byDispatcher: true,
      returned: true,
    });
    if (actor.kind === 'manager') {
      await this.audit(AUDIT_ACTIONS.deliveryConfirmReturned, actor.userId, orderId, note, {
        amount: completed.finalPrice,
      });
    }
    this.realtimeGateway.emitToUser(order.driverId, 'order:returned', {
      orderId,
      finalPrice: completed.finalPrice,
    });
    this.logger.log(`Order ${orderId}: qaytarish tasdiqlandi (${actor.kind})`);
    return completed;
  }

  /** Dispetcher: hozir "osilib qolgan" yetkazishlar (jonli hisob). */
  async listStuckDeliveries(now: Date = new Date()): Promise<StuckDelivery[]> {
    const settings = await this.settingsService.getDeliveryIncidentSettings();
    const rows = await this.activeDeliveryRows();
    return rows
      .map((row) => ({ row, reasons: stuckReasonsOf(row, now, settings) }))
      .filter(({ reasons }) => reasons.length > 0)
      .map(({ row, reasons }) => toStuckDelivery(row, reasons));
  }

  /**
   * Har daqiqa: yangi "osilib qolgan" yetkazishlarni BIR MARTA belgilaydi va
   * dispetcherlarga `delivery:stuck` yuboradi (sahifa ochiq bo'lsa darhol
   * ko'rinadi). Avtomatik jazo yo'q — faqat signal (§ tamoyil 4).
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'stuck-deliveries' })
  async handleStuckDeliveriesTick(): Promise<void> {
    try {
      await this.flagStuckDeliveries();
    } catch (err) {
      this.logger.error(`Stuck delivery scan failed: ${(err as Error).message}`);
    }
  }

  async flagStuckDeliveries(now: Date = new Date()): Promise<number> {
    const stuck = await this.listStuckDeliveries(now);
    let flagged = 0;
    for (const item of stuck) {
      const result = await this.orderRepository.update(
        { id: item.orderId, stuckFlaggedAt: IsNull() },
        { stuckFlaggedAt: now },
      );
      if (!result.affected) continue;
      flagged += 1;
      this.realtimeGateway.emitToManagers('delivery:stuck', item);
    }
    if (flagged > 0) this.logger.warn(`${flagged} ta yetkazish "osilib qolgan" deb belgilandi`);
    return flagged;
  }

  private async activeDeliveryRows(): Promise<ActiveDeliveryRow[]> {
    return (await this.orderRepository.query(
      `SELECT o.id, o.status, o.service_type, o.driver_id, o.pickup_address, o.dropoff_address,
              o.delivery_failed_at, t.start_time, d.location_updated_at,
              u.first_name AS driver_first_name, u.last_name AS driver_last_name, u.phone AS driver_phone
         FROM orders o
         LEFT JOIN trips t ON t.order_id = o.id
         LEFT JOIN drivers d ON d.user_id = o.driver_id
         LEFT JOIN users u ON u.id = o.driver_id
        WHERE o.status IN ('accepted', 'arrived', 'in_progress')
          AND o.service_type = ANY($1)
        ORDER BY o.created_at ASC
        LIMIT ${STUCK_SCAN_LIMIT}`,
      [[...TRACKED_DELIVERY_SERVICE_TYPES]],
    )) as ActiveDeliveryRow[];
  }

  private async assertNearDropoff(driverId: string, orderId: string): Promise<void> {
    const rows = (await this.orderRepository.query(
      `SELECT ST_Distance(
         (SELECT current_location::geometry FROM drivers WHERE user_id = $1)::geography,
         (SELECT dropoff_location::geometry FROM orders WHERE id = $2)::geography
       ) AS distance_meters`,
      [driverId, orderId],
    )) as Array<{ distance_meters: number | string | null }>;
    const raw = rows[0]?.distance_meters;
    const meters = raw != null ? parseFloat(String(raw)) : Number.POSITIVE_INFINITY;
    if (meters > DROPOFF_GEOFENCE_METERS) {
      throw new BadRequestException(
        `Manzilga ${DROPOFF_GEOFENCE_METERS} m dan yaqin bo'lishingiz kerak (hozir ${Number.isFinite(meters) ? Math.round(meters) : '?'} m)`,
      );
    }
  }

  private async audit(
    action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
    actorUserId: string,
    orderId: string,
    note: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!this.auditLog) return;
    await this.auditLog.record({ actorUserId, action, targetType: 'order', targetId: orderId, note, metadata });
  }

  /** Push — best-effort: xato holat o'tishini yiqitmaydi. */
  private async push(
    userIds: string[],
    text: Parameters<NotificationsService['notifyUserIds']>[1],
    event: string,
    orderId: string,
  ): Promise<void> {
    try {
      await this.notificationsService?.notifyUserIds(userIds, text, event, { orderId });
    } catch (err) {
      this.logger.warn(`Push ${event} for order ${orderId} failed: ${(err as Error).message}`);
    }
  }
}
