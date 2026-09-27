import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LostItemReport, LostItemStatus } from '../../database/entities/lost-item-report.entity';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { User, UserRole } from '../../database/entities/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { DriverLostItemResponseDto, OperatorLostItemUpdateDto, ReportLostItemDto } from './dto/lost-item.dto';

/** How long after a ride the passenger can still report something left in the car. */
export const LOST_ITEM_REPORT_WINDOW_DAYS = 7;
const LIST_LIMIT = 50;
const OPERATOR_LIST_LIMIT = 200;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Operator row: the report plus the two phones needed to arrange a handover. */
export interface OperatorLostItemView extends LostItemReport {
  passengerPhone: string | null;
  passengerName: string | null;
  driverPhone: string | null;
  driverName: string | null;
}

function fullName(user: User | undefined): string | null {
  if (!user) return null;
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
}

@Injectable()
export class LostItemsService {
  constructor(
    @InjectRepository(LostItemReport)
    private readonly reportRepository: Repository<LostItemReport>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly usersService: UsersService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async report(passengerId: string, dto: ReportLostItemDto, now: Date = new Date()): Promise<LostItemReport> {
    const order = await this.orderRepository.findOne({ where: { id: dto.orderId } });
    // Same 404 for "not yours" as for "does not exist": a passenger must not be
    // able to probe other people's order ids.
    if (!order || order.passengerId !== passengerId) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.COMPLETED || !order.driverId) {
      throw new BadRequestException('Faqat yakunlangan safar uchun xabar berish mumkin');
    }
    const completedAt = order.completedAt ?? order.updatedAt;
    if (completedAt && now.getTime() - completedAt.getTime() > LOST_ITEM_REPORT_WINDOW_DAYS * MS_PER_DAY) {
      throw new BadRequestException(
        `Safardan ${LOST_ITEM_REPORT_WINDOW_DAYS} kundan ko'p vaqt o'tgan — qo'llab-quvvatlash xizmatiga yozing`,
      );
    }

    const open = await this.reportRepository.findOne({
      where: { orderId: order.id, status: In([LostItemStatus.OPEN, LostItemStatus.FOUND]) },
    });
    if (open) {
      throw new ConflictException('Bu safar bo‘yicha xabar allaqachon yuborilgan');
    }

    const saved = await this.reportRepository.save({
      orderId: order.id,
      passengerId,
      driverUserId: order.driverId,
      description: dto.description,
      status: LostItemStatus.OPEN,
      driverNote: null,
      operatorNote: null,
    });

    this.realtimeGateway.emitToUser(order.driverId, 'lost_item:reported', {
      id: saved.id,
      orderId: order.id,
      description: saved.description,
    });
    this.realtimeGateway.emitToManagers('lost_item:updated', saved);
    const driver = await this.usersService.findById(order.driverId);
    if (driver) {
      await this.notificationsService.notifyLostItemReported(driver, saved.description);
    }
    return saved;
  }

  /** Passenger's own reports, or the reports about a driver's rides. */
  async listMine(user: User): Promise<LostItemReport[]> {
    const where = user.role === UserRole.DRIVER ? { driverUserId: user.id } : { passengerId: user.id };
    return this.reportRepository.find({ where, order: { createdAt: 'DESC' }, take: LIST_LIMIT });
  }

  async driverRespond(
    driverUserId: string,
    id: string,
    dto: DriverLostItemResponseDto,
  ): Promise<LostItemReport> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.driverUserId !== driverUserId) {
      throw new ForbiddenException('This report is about another driver’s ride');
    }

    const status = dto.found ? LostItemStatus.FOUND : LostItemStatus.NOT_FOUND;
    const note = dto.note?.trim() || null;
    // Conditional on OPEN so a second tap (or a late retry) cannot flip an
    // answer the dispatcher is already acting on.
    const result = await this.reportRepository.update(
      { id, status: LostItemStatus.OPEN },
      { status, driverNote: note },
    );
    if (!result.affected) {
      throw new ConflictException('Siz bu xabarga allaqachon javob bergansiz');
    }

    const updated = { ...report, status, driverNote: note };
    this.realtimeGateway.emitToUser(report.passengerId, 'lost_item:updated', updated);
    this.realtimeGateway.emitToManagers('lost_item:updated', updated);
    const passenger = await this.usersService.findById(report.passengerId);
    if (passenger) {
      await this.notificationsService.notifyLostItemAnswered(passenger, dto.found);
    }
    return updated;
  }

  async listForOperators(status?: LostItemStatus): Promise<OperatorLostItemView[]> {
    const reports = await this.reportRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'ASC' },
      take: OPERATOR_LIST_LIMIT,
    });
    if (reports.length === 0) return [];

    const userIds = [...new Set(reports.flatMap((r) => [r.passengerId, r.driverUserId]))];
    const users = await this.usersService.findByIds(userIds);
    const byId = new Map(users.map((u) => [u.id, u]));

    return reports.map((report) => {
      const passenger = byId.get(report.passengerId);
      const driver = byId.get(report.driverUserId);
      return {
        ...report,
        passengerPhone: passenger?.phone ?? null,
        passengerName: fullName(passenger),
        driverPhone: driver?.phone ?? null,
        driverName: fullName(driver),
      };
    });
  }

  async operatorUpdate(id: string, dto: OperatorLostItemUpdateDto): Promise<LostItemReport> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status === LostItemStatus.RETURNED || report.status === LostItemStatus.CLOSED) {
      throw new ConflictException('Bu xabar allaqachon yopilgan');
    }
    const note = dto.note?.trim() || null;
    await this.reportRepository.update(id, { status: dto.status, operatorNote: note });
    const updated = { ...report, status: dto.status, operatorNote: note };
    this.realtimeGateway.emitToUser(report.passengerId, 'lost_item:updated', updated);
    this.realtimeGateway.emitToManagers('lost_item:updated', updated);
    return updated;
  }
}
