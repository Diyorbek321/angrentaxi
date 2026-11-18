import { ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterruptReason, Order, OrderStatus } from '../../database/entities/order.entity';
import { UserRole } from '../../database/entities/user.entity';
import { ERROR_CODES, codedBadRequest } from '../../common/errors/coded-error';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import { DriversService } from '../drivers/drivers.service';
import { IncidentSignalsService } from '../incidents/incident-signals.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { OrdersCompletionService } from './orders-completion.service';
import { OrdersQueryService } from './orders-query.service';
import { penaltiesApply } from './taxi-cancel-policy';
import { straightLineKm } from './trip-interruption';

export interface LatLng {
  lat: number;
  lng: number;
}

export type InterruptedTrip = Order & { resumeFrom: LatLng | null };

export interface InterruptInput {
  reason: InterruptReason;
  note?: string;
  lat?: number;
  lng?: number;
}

/**
 * Safar uzildi — avariya / buzilish (docs/INCIDENT-POLICY.md §5). Faqat
 * IN_PROGRESS taksi/yuk safari. Haydovchi yoki menejer belgilaydi; narx —
 * shu nuqtagacha (`trip-interruption.ts`), buyurtma `trip_outcome =
 * interrupted` bilan yakunlanadi. Yo'lovchiga `order:interrupted` (joriy
 * nuqta bilan) — ilova shu yerdan yangi qidiruvni taklif qiladi. Avariyada
 * xavfsizlik hodisasi menejer navbatiga (avtomatik jazo yo'q).
 */
@Injectable()
export class OrdersInterruptionService {
  private readonly logger = new Logger(OrdersInterruptionService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly queryService: OrdersQueryService,
    private readonly completionService: OrdersCompletionService,
    private readonly driversService: DriversService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly auditLog: AuditLogService,
    @Optional() private readonly incidentSignals?: IncidentSignalsService,
  ) {}

  async interrupt(orderId: string, actor: { id: string; role: UserRole }, input: InterruptInput): Promise<InterruptedTrip> {
    const order = await this.queryService.findByIdOrThrow(orderId);
    const byManager = actor.role === UserRole.MANAGER || actor.role === UserRole.ADMIN;
    if (!byManager && order.driverId !== actor.id) {
      throw new ForbiddenException('You are not the driver for this order');
    }
    if (order.status !== OrderStatus.IN_PROGRESS || !order.driverId) {
      throw codedBadRequest(ERROR_CODES.tripInterruptNotAllowed, 'Faqat boshlangan safarni uzish mumkin', {
        details: { reason: 'not_in_progress' },
      });
    }
    if (!penaltiesApply(order)) {
      throw codedBadRequest(
        ERROR_CODES.tripInterruptNotAllowed,
        "Bu buyurtmani uzib bo'lmaydi — yetkazishni boshqa kuryerga biriktiring",
        { details: { reason: 'not_taxi' } },
      );
    }

    const point = await this.interruptionPoint(order, input);
    const pickup = (order as unknown as { pickup?: Partial<LatLng> }).pickup;
    const distanceKm =
      point && typeof pickup?.lat === 'number' && typeof pickup?.lng === 'number'
        ? straightLineKm({ lat: pickup.lat, lng: pickup.lng }, point)
        : 0;
    // Qat'iy narxli safarda chek va tarix haqiqiy tugash joyini ko'rsatsin
    // (taksometrda buni yakunlashning o'zi qiladi).
    if (point && !order.isMetered) {
      await this.orders.query(
        `UPDATE orders SET dropoff_location = ST_SetSRID(ST_MakePoint($2, $3), 4326) WHERE id = $1`,
        [orderId, point.lng, point.lat],
      );
    }

    const completed = await this.completionService.completeTrip(order.driverId, orderId, undefined, {
      byDispatcher: byManager,
      interruption: { reason: input.reason, distanceKm },
    });

    const note = input.note?.trim() || null;
    await this.auditLog.record({
      actorUserId: actor.id,
      action: AUDIT_ACTIONS.orderInterrupted,
      targetType: 'order',
      targetId: orderId,
      amount: completed.finalPrice ?? null,
      note,
      metadata: { reason: input.reason, byRole: byManager ? 'manager' : 'driver', distanceKm, point },
    });
    this.logger.log(
      `Order ${orderId} interrupted (${input.reason}) by ${byManager ? 'manager' : 'driver'} ${actor.id}: ` +
        `${distanceKm.toFixed(2)} km, ${completed.finalPrice} so'm`,
    );

    if (input.reason === 'accident') {
      try {
        await this.incidentSignals?.onTripInterrupted({
          orderId,
          driverUserId: order.driverId,
          passengerId: order.passengerId,
          note,
          byRole: byManager ? 'manager' : 'driver',
        });
      } catch (err) {
        this.logger.warn(`Interruption incident for ${orderId} failed: ${(err as Error).message}`);
      }
    }

    this.realtimeGateway.emitToUser(order.passengerId, 'order:interrupted', {
      orderId,
      reason: input.reason,
      finalPrice: completed.finalPrice,
      resumeFrom: point,
    });
    if (byManager) {
      this.realtimeGateway.emitToUser(order.driverId, 'order:interrupted', { orderId, reason: input.reason });
    }
    return { ...completed, resumeFrom: point };
  }

  /** Haydovchi yuborgan joy → oxirgi iz nuqtasi → bazadagi oxirgi joylashuv. */
  private async interruptionPoint(order: Order, input: InterruptInput): Promise<LatLng | null> {
    if (typeof input.lat === 'number' && typeof input.lng === 'number') return { lat: input.lat, lng: input.lng };
    const rows = (await this.orders.query(
      `SELECT lat, lng FROM trip_track_points WHERE order_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [order.id],
    )) as Array<{ lat: number; lng: number }>;
    if (rows.length > 0) return { lat: Number(rows[0].lat), lng: Number(rows[0].lng) };
    return order.driverId ? this.driversService.getLastLocationByUserId(order.driverId) : null;
  }
}
