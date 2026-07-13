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

  /** Admin/manager only — newest-first list of currently active alerts. Guarded at the controller by RolesGuard. */
  async listActive(): Promise<SosAlert[]> {
    return this.sosAlertRepository.find({
      where: { status: SosAlertStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }
}
