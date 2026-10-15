import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';

/** Jurnalga yoziladigan amal turlari — satrlar bir joyda (filtrlar shunga tayanadi). */
export const AUDIT_ACTIONS = {
  walletManualAdjustment: 'wallet.manual_adjustment',
  shiftPassCancel: 'shift_pass.cancel',
  /** Admin sotuvchi STIR'ini o'zgartirdi (restoran/do'kon). */
  vendorTinUpdate: 'vendor.tin_update',
  /** Karta to'lovi qaytarildi — haydovchi/sotuvchi ulushi hamyondan qaytarib olindi (tizim amali). */
  paymentRefundClawback: 'payment.refund_clawback',
  /** Haydovchi PINFL/STIR/soliq maqomi o'zgardi (o'zi yoki menejer). `metadata.changes` — niqoblangan. */
  driverLegalUpdate: 'driver.legal_update',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEntryInput {
  actorUserId: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string | null;
  amount?: number | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditLogQuery {
  action?: string;
  targetType?: string;
  targetId?: string;
  page: number;
  limit: number;
}

/** Amalni bajargan xodim (`users`) — o'chirilgan/tizim amali bo'lsa `null`. */
export interface AuditActor {
  id: string;
  name: string | null;
  phone: string | null;
  role: string;
}

export type AuditLogItem = AuditLog & { actor: AuditActor | null };

export interface AuditLogPage {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Umumiy amallar jurnali (docs/LEGAL-COMPLIANCE.md §12). Pulga tegadigan
 * qo'lda amal shu yerga yoziladi — iloji bo'lsa pul harakati bilan BITTA
 * tranzaksiyada (`manager` uzatiladi): jurnalsiz pul harakati ham, pulsiz
 * jurnal yozuvi ham bo'lmasin.
 */
@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
  ) {}

  async record(entry: AuditEntryInput, manager?: EntityManager): Promise<AuditLog> {
    const repo = manager ? manager.getRepository(AuditLog) : this.repository;
    return repo.save(
      repo.create({
        actorUserId: entry.actorUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        amount: entry.amount ?? null,
        note: entry.note ?? null,
        metadata: entry.metadata ?? {},
      }),
    );
  }

  async list(query: AuditLogQuery): Promise<AuditLogPage> {
    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
    };
    const [items, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    const actors = await this.loadActors(items);
    return {
      items: items.map((item) => ({
        ...item,
        actor: item.actorUserId ? (actors.get(item.actorUserId) ?? null) : null,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  /** Sahifadagi aktyorlar — BITTA so'rovda (N+1 emas). */
  private async loadActors(items: AuditLog[]): Promise<Map<string, AuditActor>> {
    const ids = [...new Set(items.map((item) => item.actorUserId).filter((id): id is string => !!id))];
    if (ids.length === 0) return new Map();
    const users = await this.repository.manager.find(User, {
      where: { id: In(ids) },
      select: ['id', 'firstName', 'lastName', 'phone', 'role'],
    });
    return new Map(
      users.map((user) => [
        user.id,
        {
          id: user.id,
          name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
          phone: user.phone ?? null,
          role: user.role,
        },
      ]),
    );
  }
}
