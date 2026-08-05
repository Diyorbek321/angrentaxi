import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SosAlert,
  SosAlertStatus,
  SosReporterRole,
} from '../../database/entities/sos-alert.entity';
import { OrdersService } from '../orders/orders.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ReportSosDto } from './dto/report-sos.dto';

// Upper bound on the active-alert feed (see listActive). Active SOS alerts are
// an exception queue, not a history: a healthy city has single digits open at a
// time, so this is a runaway guard rather than pagination. Sized like the
// dispatcher board cap in OrdersQueryService for the same reason.
export const ACTIVE_SOS_ALERTS_LIMIT = 200;

@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);

  constructor(
    @InjectRepository(SosAlert)
    private readonly sosAlertRepository: Repository<SosAlert>,
    private readonly ordersService: OrdersService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /**
   * Raise an emergency alert on a trip. Only the order's own passenger or
   * driver may report — same order-membership check used elsewhere (e.g.
   * RatingsService.submitRating) — then the alert is persisted and pushed
   * to every connected manager/admin dashboard over the 'managers' socket
   * room via RealtimeGateway.emitToManagers.
   */
  async reportSos(
    orderId: string,
    reporterId: string,
    role: SosReporterRole,
    dto: ReportSosDto,
  ): Promise<SosAlert> {
    const order = await this.ordersService.findByIdOrThrow(orderId);

    const isPassenger = role === SosReporterRole.PASSENGER && order.passengerId === reporterId;
    const isDriver = role === SosReporterRole.DRIVER && order.driverId === reporterId;

    if (!isPassenger && !isDriver) {
      throw new ForbiddenException('You are not a party to this order');
    }

    const alert = this.sosAlertRepository.create({
      orderId,
      reportedByUserId: reporterId,
      reportedByRole: role,
      lat: dto.lat,
      lng: dto.lng,
      status: SosAlertStatus.ACTIVE,
    });

    const saved = await this.sosAlertRepository.save(alert);

    this.logger.warn(`SOS alert ${saved.id} raised by ${role} ${reporterId} on order ${orderId}`);

    this.realtimeGateway.emitToManagers('sos:alert', {
      ...saved,
      orderId,
      reporterRole: role,
    });

    return saved;
  }

  /** Admin/manager only — marks an alert resolved. Guarded at the controller by RolesGuard. */
  async resolveSos(alertId: string): Promise<SosAlert> {
    const alert = await this.sosAlertRepository.findOne({ where: { id: alertId } });

    if (!alert) {
      throw new NotFoundException(`SOS alert ${alertId} not found`);
    }

    alert.status = SosAlertStatus.RESOLVED;
    alert.resolvedAt = new Date();

    return this.sosAlertRepository.save(alert);
  }

  /**
   * Admin/manager only — newest-first list of currently active alerts. Guarded
   * at the controller by RolesGuard.
   *
   * Hard-capped at ACTIVE_SOS_ALERTS_LIMIT rows. This used to be an unbounded
   * `find()` polled by every open manager dashboard, so a backlog of alerts
   * nobody resolved (they only leave this list when explicitly resolved) grew
   * the response without limit.
   *
   * The response stays a bare `SosAlert[]` because web-manager's
   * `getActiveSosAlerts()` unwraps `ApiResponse<SosAlert[]>` directly and the
   * mobile client hits the same `/sos/active` endpoint — an envelope would
   * break both. Truncation is therefore signalled out-of-band as a warning log.
   */
  async listActive(): Promise<SosAlert[]> {
    const alerts = await this.sosAlertRepository.find({
      where: { status: SosAlertStatus.ACTIVE },
      order: { createdAt: 'DESC' },
      take: ACTIVE_SOS_ALERTS_LIMIT,
    });

    if (alerts.length === ACTIVE_SOS_ALERTS_LIMIT) {
      this.logger.warn(
        `Active SOS alerts hit the ${ACTIVE_SOS_ALERTS_LIMIT}-row cap; ` +
          'older unresolved alerts are not being shown to dispatchers.',
      );
    }

    return alerts;
  }

  // Backs the dispatcher Shift Report's "SOS resolved" stat — counts alerts
  // resolved today alongside how many are still open, so the report can show
  // "3 / 4 · 1 still open" rather than just a resolved count in isolation.
  async getTodaySummary(): Promise<{ resolvedToday: number; stillOpen: number }> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [resolvedToday, stillOpen] = await Promise.all([
      this.sosAlertRepository
        .createQueryBuilder('s')
        .where('s.status = :resolved', { resolved: SosAlertStatus.RESOLVED })
        .andWhere('s.resolved_at >= :d', { d: startOfToday })
        .getCount(),
      this.sosAlertRepository.count({ where: { status: SosAlertStatus.ACTIVE } }),
    ]);

    return { resolvedToday, stillOpen };
  }
}
