import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, ServiceType } from '../../database/entities/order.entity';
import { CalleeType, CallerRole, OrderCallLog } from '../../database/entities/order-call-log.entity';
import { UserRole } from '../../database/entities/user.entity';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import { callWindowOpen } from './contact-policy';

export interface CallRelayResult {
  phone: string;
  calleeRole: 'passenger' | 'driver' | 'recipient';
}

export type CallTarget = 'counterparty' | 'recipient';

/**
 * "Ilova orqali qo'ng'iroq" (INCIDENT-POLICY §4). Raqam faqat buyurtma
 * ishtirokchisiga va faqat faol buyurtmada beriladi; har so'rov
 * `order_call_logs` ga va audit jurnaliga BITTA tranzaksiyada yoziladi.
 * B reja (operator orqali virtual raqam) — shu endpoint ortida almashtiriladi.
 */
@Injectable()
export class OrderCallsService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderCallLog) private readonly callLogs: Repository<OrderCallLog>,
    private readonly auditLog: AuditLogService,
  ) {}

  async requestCall(
    orderId: string,
    user: { id: string; role: UserRole | string },
    target: CallTarget = 'counterparty',
  ): Promise<CallRelayResult> {
    const order = await this.orders.findOne({ where: { id: orderId }, relations: ['passenger', 'driver'] });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    // Buyurtma egasi — rolidan qat'i nazar (menejer ham yo'lovchi bo'la oladi);
    // haydovchi faqat o'ziga biriktirilganida.
    const isDriver = user.role === UserRole.DRIVER && order.driverId === user.id;
    const isPassenger = user.role !== UserRole.DRIVER && order.passengerId === user.id;
    if (!isDriver && !isPassenger) throw new ForbiddenException('Siz bu buyurtma ishtirokchisi emassiz');
    if (!callWindowOpen(order.status)) {
      throw new BadRequestException("Qo'ng'iroq faqat faol buyurtma davomida mumkin");
    }

    const callerRole: CallerRole = isDriver ? 'driver' : 'passenger';
    const callee = target === 'recipient' ? recipientCallee(order, isDriver) : counterpartyCallee(order, isDriver);
    const { phone, calleeRole, calleeType, calleeUserId } = callee;
    if (!phone) throw new BadRequestException("Qarshi tomon raqami mavjud emas");

    await this.callLogs.manager.transaction(async (manager) => {
      const log = await manager.save(
        OrderCallLog,
        manager.create(OrderCallLog, { orderId, callerUserId: user.id, callerRole, calleeUserId, calleeType }),
      );
      await this.auditLog.record(
        {
          actorUserId: user.id,
          action: AUDIT_ACTIONS.orderCallRequest,
          targetType: 'order',
          targetId: orderId,
          metadata: { callerRole, calleeUserId, calleeType, callLogId: log.id },
        },
        manager,
      );
    });

    return { phone, calleeRole };
  }
}

interface Callee {
  phone: string | null;
  calleeRole: CallRelayResult['calleeRole'];
  calleeType: CalleeType | null;
  calleeUserId: string | null;
}

function counterpartyCallee(order: Order, isDriver: boolean): Callee {
  return {
    phone: isDriver ? customerPhoneOf(order) : (order.driver?.phone ?? null),
    calleeRole: isDriver ? 'passenger' : 'driver',
    calleeType: null,
    calleeUserId: isDriver ? order.passengerId : order.driverId,
  };
}

/** Posilka qabul qiluvchisi — ilova foydalanuvchisi emas, unga faqat kuryer qo'ng'iroq qiladi. */
function recipientCallee(order: Order, isDriver: boolean): Callee {
  if (!isDriver) throw new ForbiddenException('Siz bu buyurtma ishtirokchisi emassiz');
  const phone = order.serviceType === ServiceType.PARCEL ? order.details?.recipientPhone : null;
  return {
    phone: typeof phone === 'string' ? phone : null,
    calleeRole: 'recipient',
    calleeType: 'recipient',
    calleeUserId: null,
  };
}

/** Yetkazishda mijozning aloqa raqami (`details.customerPhone`), bo'lmasa yo'lovchi akkaunti raqami. */
function customerPhoneOf(order: Order): string | null {
  const contact = order.details?.customerPhone;
  if (typeof contact === 'string' && contact.trim()) return contact.trim();
  return order.passenger?.phone ?? null;
}
