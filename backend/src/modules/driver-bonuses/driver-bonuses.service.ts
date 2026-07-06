import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import {
  BonusRuleStatus,
  BonusRuleType,
  DriverBonusRule,
} from '../../database/entities/driver-bonus-rule.entity';
import { DriverBonusAward } from '../../database/entities/driver-bonus-award.entity';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../database/entities/transaction.entity';
import { PaymentMethod } from '../../database/entities/order.entity';
import { CreateBonusRuleDto } from './dto/create-bonus-rule.dto';
import { UpdateBonusRuleDto } from './dto/update-bonus-rule.dto';

export interface DriverBonusProgress {
  ruleId: string;
  name: string;
  ruleType: BonusRuleType;
  tripThreshold: number;
  bonusAmount: number;
  currentCount: number;
}

@Injectable()
export class DriverBonusesService {
  constructor(
    @InjectRepository(DriverBonusRule)
    private readonly ruleRepository: Repository<DriverBonusRule>,
    @InjectRepository(DriverBonusAward)
    private readonly awardRepository: Repository<DriverBonusAward>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async create(createdBy: string, dto: CreateBonusRuleDto): Promise<DriverBonusRule> {
    return this.ruleRepository.save({
      name: dto.name,
      ruleType: dto.ruleType,
      tripThreshold: dto.tripThreshold,
      bonusAmount: dto.bonusAmount,
      serviceType: dto.serviceType ?? null,
      status: BonusRuleStatus.ACTIVE,
      createdBy,
    });
  }

  async findAll(): Promise<DriverBonusRule[]> {
    return this.ruleRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findByIdOrThrow(id: string): Promise<DriverBonusRule> {
    const rule = await this.ruleRepository.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Bonus rule with id ${id} not found`);
    }
    return rule;
  }

  async update(id: string, dto: UpdateBonusRuleDto): Promise<DriverBonusRule> {
    const rule = await this.findByIdOrThrow(id);
    return this.ruleRepository.save({
      ...rule,
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.ruleType !== undefined && { ruleType: dto.ruleType }),
      ...(dto.tripThreshold !== undefined && { tripThreshold: dto.tripThreshold }),
      ...(dto.bonusAmount !== undefined && { bonusAmount: dto.bonusAmount }),
      ...(dto.serviceType !== undefined && { serviceType: dto.serviceType }),
      ...(dto.status !== undefined && { status: dto.status }),
    });
  }

  // Called after every completed trip. Best-effort by design (caller catches);
  // evaluates every active rule against the driver's trip history and awards
  // any rule whose threshold is newly met.
  async evaluateForDriver(driverId: string): Promise<void> {
    const activeRules = await this.ruleRepository.find({
      where: { status: BonusRuleStatus.ACTIVE },
    });

    for (const rule of activeRules) {
      if (rule.ruleType === BonusRuleType.TRIP_COUNT) {
        const totalTrips = await this.countCompletedTrips(driverId, rule.serviceType);
        if (totalTrips > 0 && totalTrips % rule.tripThreshold === 0) {
          const tier = totalTrips / rule.tripThreshold;
          await this.awardIfNotAlready(rule, driverId, `tier-${tier}`);
        }
      } else {
        const weekKey = this.getIsoWeekKey(new Date());
        const tripsThisWeek = await this.countCompletedTrips(
          driverId,
          rule.serviceType,
          this.getStartOfIsoWeek(new Date()),
        );
        if (tripsThisWeek >= rule.tripThreshold) {
          await this.awardIfNotAlready(rule, driverId, weekKey);
        }
      }
    }
  }

  async getProgressForDriver(driverId: string): Promise<DriverBonusProgress[]> {
    const activeRules = await this.ruleRepository.find({
      where: { status: BonusRuleStatus.ACTIVE },
    });

    const progress: DriverBonusProgress[] = [];
    for (const rule of activeRules) {
      const currentCount =
        rule.ruleType === BonusRuleType.TRIP_COUNT
          ? (await this.countCompletedTrips(driverId, rule.serviceType)) % rule.tripThreshold
          : await this.countCompletedTrips(
              driverId,
              rule.serviceType,
              this.getStartOfIsoWeek(new Date()),
            );

      progress.push({
        ruleId: rule.id,
        name: rule.name,
        ruleType: rule.ruleType,
        tripThreshold: rule.tripThreshold,
        bonusAmount: rule.bonusAmount,
        currentCount,
      });
    }
    return progress;
  }

  private async countCompletedTrips(
    driverId: string,
    serviceType: string | null,
    since?: Date,
  ): Promise<number> {
    return this.orderRepository.count({
      where: {
        driverId,
        status: OrderStatus.COMPLETED,
        ...(serviceType ? { serviceType: serviceType as Order['serviceType'] } : {}),
        ...(since ? { createdAt: MoreThanOrEqual(since) } : {}),
      },
    });
  }

  // Award = a CREDIT Transaction + a DriverBonusAward idempotency row, in one
  // DB transaction. The UNIQUE(bonusRuleId, driverId, periodKey) constraint
  // makes double-award impossible even under concurrent completeTrip() calls;
  // a unique-violation here just means another call already paid this period.
  private async awardIfNotAlready(
    rule: DriverBonusRule,
    driverId: string,
    periodKey: string,
  ): Promise<void> {
    const existing = await this.awardRepository.findOne({
      where: { bonusRuleId: rule.id, driverId, periodKey },
    });
    if (existing) return;

    try {
      await this.awardRepository.manager.transaction(async (manager) => {
        const transaction = await manager.save(Transaction, {
          userId: driverId,
          orderId: null,
          amount: rule.bonusAmount,
          type: TransactionType.CREDIT,
          paymentMethod: PaymentMethod.WALLET,
          status: TransactionStatus.COMPLETED,
          externalId: null,
          bonusRuleId: rule.id,
        });

        await manager.save(DriverBonusAward, {
          bonusRuleId: rule.id,
          driverId,
          periodKey,
          transactionId: transaction.id,
        });
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== '23505') {
        throw err;
      }
    }
  }

  private getIsoWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  private getStartOfIsoWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay() || 7;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day + 1);
    return d;
  }
}
