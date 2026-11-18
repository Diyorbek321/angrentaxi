import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { Incident, IncidentStatus, IncidentVertical } from '../../database/entities/incident.entity';
import { User, UserRole } from '../../database/entities/user.entity';
import { ERROR_CODES, codedBadRequest, codedConflict } from '../../common/errors/coded-error';
import { SettingsService } from '../settings/settings.service';
import { DEFAULT_INCIDENT_SETTINGS, IncidentSettings } from '../settings/incident-settings';
import { IncidentCategory, isUserCategory } from './incident-policy';
import { IncidentOrderContext, loadIncidentOrder } from './incident-orders';
import { SubjectChoice, resolveSubject } from './incident-subject';
import { StrikeInfo, countConfirmedStrikes, strikeInfo } from './incident-strikes';

export interface IncidentListQuery {
  status?: IncidentStatus | 'active';
  category?: string;
  vertical?: IncidentVertical;
  page?: number;
  limit?: number;
}

export interface PartyView {
  id: string;
  name: string | null;
  phone: string | null;
  role: string;
  status: string;
  suspendedUntil: Date | null;
  /** Haydovchi bo'lsa — yo'lovchilar bergan o'rtacha baho. */
  driverRating: number | null;
  /** Haydovchilar bergan o'rtacha baho (yo'lovchi). */
  passengerRating: number | null;
  passengerRatingCount: number;
}

export interface IncidentListItem extends Incident {
  /** Ochilganidan beri soat — SLA nishoni. */
  ageHours: number;
  reporter: PartyView | null;
  subject: PartyView | null;
}

export interface IncidentDetail extends IncidentListItem {
  order: IncidentOrderContext | null;
  evidence: {
    ratings: Array<{ id: string; fromRole: string; score: number; comment: string | null; createdAt: Date }>;
    sos: Array<{ id: string; status: string; reportedByRole: string; createdAt: Date; resolvedAt: Date | null }>;
    lostItems: Array<{ id: string; status: string; description: string; createdAt: Date }>;
    photoCount: number;
  };
  strikes: StrikeInfo | null;
  /** Subyektga oldingi hodisalar (oxirgi 10). */
  subjectHistory: Array<Pick<Incident, 'id' | 'category' | 'status' | 'confirmedAgainstSubject' | 'createdAt'>>;
}

const ACTIVE = [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING];

/** Menejer navbati va dalil sahifasi (INCIDENT-POLICY tamoyil 3: hammasi bitta sahifada). */
@Injectable()
export class IncidentReviewService {
  constructor(
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    private readonly dataSource: DataSource,
    @Optional() private readonly settingsService?: SettingsService,
  ) {}

  async list(query: IncidentListQuery, now: Date = new Date()): Promise<{ items: IncidentListItem[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 30;
    const where: FindOptionsWhere<Incident> = {
      ...(query.status === 'active' ? { status: In(ACTIVE) } : query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.vertical ? { orderVertical: query.vertical } : {}),
    };
    const [rows, total] = await this.incidents.findAndCount({
      where,
      // Eskisi birinchi (navbat) faol holatlarda; tarix — yangisi birinchi.
      order: { createdAt: query.status === 'active' || query.status === 'open' || query.status === 'investigating' ? 'ASC' : 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const parties = await this.loadParties(rows.flatMap((r) => [r.reporterUserId, r.subjectUserId]));
    return { items: rows.map((r) => this.withParties(r, parties, now)), total, page, limit };
  }

  async openCount(): Promise<{ count: number; escalated: number }> {
    const [count, escalated] = await Promise.all([
      this.incidents.count({ where: { status: In(ACTIVE) } }),
      this.incidents.count({ where: { escalatedToAdmin: true, status: In([...ACTIVE, IncidentStatus.RESOLVED]) } }),
    ]);
    return { count, escalated };
  }

  async byOrder(vertical: IncidentVertical, orderId: string, now: Date = new Date()): Promise<IncidentListItem[]> {
    const rows = await this.incidents.find({ where: { orderVertical: vertical, orderId }, order: { createdAt: 'DESC' } });
    const parties = await this.loadParties(rows.flatMap((r) => [r.reporterUserId, r.subjectUserId]));
    return rows.map((r) => this.withParties(r, parties, now));
  }

  async detail(id: string, now: Date = new Date()): Promise<IncidentDetail> {
    const incident = await this.incidents.findOne({ where: { id } });
    if (!incident) throw new NotFoundException('Murojaat topilmadi');
    const settings = await this.settings();
    const query = (sql: string, p: unknown[]) => this.dataSource.query(sql, p);
    const order =
      incident.orderVertical && incident.orderId ? await loadIncidentOrder(query, incident.orderVertical, incident.orderId) : null;
    const ride = order?.rideOrderId ?? null;
    const [parties, ratings, sos, lostItems, confirmed, history] = await Promise.all([
      this.loadParties([incident.reporterUserId, incident.subjectUserId]),
      ride
        ? query(`SELECT id, from_role AS "fromRole", score, comment, created_at AS "createdAt" FROM ratings WHERE order_id = $1`, [ride])
        : Promise.resolve([]),
      ride
        ? query(
            `SELECT id, status, reported_by_role AS "reportedByRole", created_at AS "createdAt", resolved_at AS "resolvedAt"
               FROM sos_alerts WHERE order_id = $1 ORDER BY created_at`,
            [ride],
          )
        : Promise.resolve([]),
      ride
        ? query(`SELECT id, status, description, created_at AS "createdAt" FROM lost_item_reports WHERE order_id = $1`, [ride])
        : Promise.resolve([]),
      incident.subjectUserId
        ? countConfirmedStrikes(query, incident.subjectUserId, settings.strikeWindowDays, now, incident.id)
        : Promise.resolve(null),
      incident.subjectUserId
        ? this.incidents.find({
            where: { subjectUserId: incident.subjectUserId },
            order: { createdAt: 'DESC' },
            take: 11,
            select: ['id', 'category', 'status', 'confirmedAgainstSubject', 'createdAt'],
          })
        : Promise.resolve([]),
    ]);
    return {
      ...this.withParties(incident, parties, now),
      order,
      evidence: {
        ratings: (ratings as IncidentDetail['evidence']['ratings']) ?? [],
        sos: (sos as IncidentDetail['evidence']['sos']) ?? [],
        lostItems: (lostItems as IncidentDetail['evidence']['lostItems']) ?? [],
        photoCount: (incident.photoKeys ?? []).length,
      },
      strikes: confirmed === null ? null : strikeInfo(confirmed, settings),
      subjectHistory: (history as Incident[]).filter((h) => h.id !== incident.id).slice(0, 10),
    };
  }

  /** "Menga olish" — open → investigating; boshqa menejerdan tortib olinmaydi. */
  async assignToMe(actorId: string, id: string): Promise<Incident> {
    const incident = await this.incidents.findOne({ where: { id } });
    if (!incident) throw new NotFoundException('Murojaat topilmadi');
    if (!ACTIVE.includes(incident.status)) {
      throw codedConflict(ERROR_CODES.incidentStateConflict, "Murojaat allaqachon ko'rib chiqilgan", {
        details: { status: incident.status },
      });
    }
    const result = await this.incidents
      .createQueryBuilder()
      .update(Incident)
      .set({ assignedManagerId: actorId, status: IncidentStatus.INVESTIGATING })
      .where('id = :id AND status IN (:...active) AND (assigned_manager_id IS NULL OR assigned_manager_id = :actorId)', {
        id,
        active: ACTIVE,
        actorId,
      })
      .execute();
    if (!result.affected) {
      throw codedConflict(ERROR_CODES.incidentStateConflict, 'Murojaatni boshqa menejer olgan', {
        details: { status: incident.status },
      });
    }
    return { ...incident, assignedManagerId: actorId, status: IncidentStatus.INVESTIGATING };
  }

  /** Menejer o'zi ochadi (masalan qo'ng'iroqdan keyin) — muddat cheklovisiz. */
  async createByManager(
    actor: Pick<User, 'id'>,
    input: { vertical: IncidentVertical; orderId: string; category: string; description: string; subject?: SubjectChoice },
  ): Promise<Incident> {
    if (!isUserCategory(input.category)) {
      throw codedBadRequest(ERROR_CODES.incidentNotAllowed, "Bu sababni tanlab bo'lmaydi");
    }
    const ctx = await loadIncidentOrder((s, p) => this.dataSource.query(s, p), input.vertical, input.orderId);
    if (!ctx) throw new NotFoundException('Buyurtma topilmadi');
    const subject = resolveSubject(ctx, null, input.category as IncidentCategory, input.subject);
    return this.incidents.save(
      this.incidents.create({
        reporterUserId: actor.id,
        reporterRole: 'manager',
        subjectUserId: subject?.userId ?? null,
        subjectRole: subject?.role ?? null,
        orderVertical: ctx.vertical,
        orderId: ctx.orderId,
        category: input.category,
        description: input.description.trim(),
        source: 'manager',
        assignedManagerId: actor.id,
        status: IncidentStatus.INVESTIGATING,
      }),
    );
  }

  private async settings(): Promise<IncidentSettings> {
    return this.settingsService ? this.settingsService.getIncidentSettings() : DEFAULT_INCIDENT_SETTINGS;
  }

  private withParties(incident: Incident, parties: Map<string, PartyView>, now: Date): IncidentListItem {
    const { photoKeys: _keys, ...rest } = incident;
    return {
      ...(rest as Incident),
      photoKeys: (incident.photoKeys ?? []).map((_k, i) => String(i)),
      ageHours: Math.max(0, Math.floor((now.getTime() - new Date(incident.createdAt).getTime()) / 3_600_000)),
      reporter: incident.reporterUserId ? (parties.get(incident.reporterUserId) ?? null) : null,
      subject: incident.subjectUserId ? (parties.get(incident.subjectUserId) ?? null) : null,
    };
  }

  /** Ishtirokchilar — BITTA so'rovda (N+1 emas), haydovchi bahosi bilan. */
  private async loadParties(ids: Array<string | null>): Promise<Map<string, PartyView>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map();
    const rows = (await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.phone, u.role, u.status, u.suspended_until,
              u.passenger_rating, u.passenger_rating_count, d.rating AS driver_rating
         FROM users u LEFT JOIN drivers d ON d.user_id = u.id
        WHERE u.id = ANY($1)`,
      [unique],
    )) as Array<Record<string, unknown>>;
    return new Map(
      (rows ?? []).map((r) => [
        String(r.id),
        {
          id: String(r.id),
          name: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
          phone: (r.phone as string) ?? null,
          role: String(r.role),
          status: String(r.status),
          suspendedUntil: (r.suspended_until as Date) ?? null,
          driverRating: r.role === UserRole.DRIVER && r.driver_rating != null ? Number(r.driver_rating) : null,
          passengerRating: r.passenger_rating != null ? Number(r.passenger_rating) : null,
          passengerRatingCount: Number(r.passenger_rating_count ?? 0),
        },
      ]),
    );
  }
}
