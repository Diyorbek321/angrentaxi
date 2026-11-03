import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import { Incident, IncidentStatus } from '../../database/entities/incident.entity';
import { SettingsService } from '../settings/settings.service';
import { DEFAULT_INCIDENT_SETTINGS, IncidentSettings } from '../settings/incident-settings';
import { DEFAULT_SAFETY_POLICY_SETTINGS } from '../settings/safety-policy-settings';

export interface SubmittedRating {
  id: string;
  orderId: string;
  fromUserId: string;
  toUserId: string;
  fromRole: 'passenger' | 'driver';
  score: number;
  comment: string | null;
}

/** Oxirgi N bahoning o'rtachasi chegaradan pastmi (N to'lmagan bo'lsa — signal yo'q). */
export function ratingSignalTriggered(scores: readonly number[], window: number, threshold: number): number | null {
  if (scores.length < window) return null;
  const avg = scores.slice(0, window).reduce((s, x) => s + x, 0) / window;
  return avg < threshold ? Math.round(avg * 100) / 100 : null;
}

/**
 * Avtomatik SIGNAL, avtomatik jazo emas (INCIDENT-POLICY tamoyil 4):
 *  · haydovchining oxirgi `ratingSignalWindow` bahosi o'rtachasi
 *    `ratingSignalThreshold` dan past — tizim hodisasi menejer navbatiga
 *    (bir haydovchiga `ratingSignalCooldownDays` da bir marta; ochig'i bo'lsa yangilanadi);
 *  · ≤ `lowRatingIncidentMaxScore` baho + izoh — qoralama hodisa, izohlar
 *    endi kimdir tomonidan o'qiladi.
 * Xato baho saqlashni hech qachon yiqitmaydi (chaqiruvchi ushlaydi).
 */
@Injectable()
export class IncidentSignalsService {
  private readonly logger = new Logger(IncidentSignalsService.name);

  constructor(
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    private readonly dataSource: DataSource,
    @Optional() private readonly settingsService?: SettingsService,
  ) {}

  async onRatingSubmitted(rating: SubmittedRating, now: Date = new Date()): Promise<void> {
    const settings = await this.settings();
    await this.lowRatingDraft(rating, settings);
    if (rating.fromRole === 'passenger') await this.ratingTrend(rating.toUserId, settings, now);
  }

  private async settings(): Promise<IncidentSettings> {
    return this.settingsService ? this.settingsService.getIncidentSettings() : DEFAULT_INCIDENT_SETTINGS;
  }

  private async lowRatingDraft(rating: SubmittedRating, settings: IncidentSettings): Promise<void> {
    const comment = rating.comment?.trim();
    if (!comment || rating.score > settings.lowRatingIncidentMaxScore) return;
    // Shu buyurtmada xabarchining o'z shikoyati allaqachon bor — qoralama kerak emas.
    const existing = await this.incidents.count({
      where: {
        reporterUserId: rating.fromUserId,
        orderVertical: 'taxi',
        orderId: rating.orderId,
        status: In([IncidentStatus.OPEN, IncidentStatus.INVESTIGATING]),
      },
    });
    if (existing > 0) return;
    await this.incidents.save(
      this.incidents.create({
        reporterUserId: rating.fromUserId,
        reporterRole: rating.fromRole === 'passenger' ? 'passenger' : 'driver',
        subjectUserId: rating.toUserId,
        subjectRole: rating.fromRole === 'passenger' ? 'driver' : 'passenger',
        orderVertical: 'taxi',
        orderId: rating.orderId,
        category: 'low_rating',
        description: `${rating.score}★: ${comment}`.slice(0, 1000),
        source: 'low_rating',
        ratingId: rating.id,
      }),
    );
  }

  private async ratingTrend(driverUserId: string, settings: IncidentSettings, now: Date): Promise<void> {
    const rows = (await this.dataSource.query(
      `SELECT score FROM ratings WHERE to_user_id = $1 AND from_role = 'passenger' ORDER BY created_at DESC LIMIT $2`,
      [driverUserId, settings.ratingSignalWindow],
    )) as Array<{ score: number | string }>;
    const avg = ratingSignalTriggered(
      (rows ?? []).map((r) => Number(r.score)),
      settings.ratingSignalWindow,
      settings.ratingSignalThreshold,
    );
    if (avg === null) return;
    const description = `Oxirgi ${settings.ratingSignalWindow} baho o'rtachasi ${avg} (chegara ${settings.ratingSignalThreshold})`;
    const open = await this.incidents.findOne({
      where: { subjectUserId: driverUserId, source: 'rating_signal', status: In([IncidentStatus.OPEN, IncidentStatus.INVESTIGATING]) },
    });
    if (open) {
      await this.incidents.update(open.id, { description });
      return;
    }
    const since = new Date(now.getTime() - settings.ratingSignalCooldownDays * 86_400_000);
    const recent = await this.incidents.count({
      where: { subjectUserId: driverUserId, source: 'rating_signal', createdAt: MoreThanOrEqual(since) },
    });
    if (recent > 0) return;
    await this.incidents.save(
      this.incidents.create({
        reporterUserId: null,
        reporterRole: 'system',
        subjectUserId: driverUserId,
        subjectRole: 'driver',
        category: 'rating_signal',
        description,
        source: 'rating_signal',
      }),
    );
    this.logger.log(`Rating signal for driver ${driverUserId}: avg ${avg}`);
  }

  /**
   * Haydovchi qabul qilgan buyurtmani bekor qildi (INCIDENT-POLICY §5): pul
   * yo'q, lekin sanaladi. Bugun ≥ `driverCancelSignalCount` — tizim hodisasi
   * menejer navbatiga (kuniga bir marta; ochig'i bo'lsa matni yangilanadi).
   * "Yo'lovchi chiqmadi" sanalmaydi — u haydovchining aybi emas.
   */
  async onDriverCancelled(driverUserId: string, now: Date = new Date()): Promise<void> {
    const threshold = this.settingsService
      ? (await this.settingsService.getSafetyPolicySettings()).driverCancelSignalCount
      : DEFAULT_SAFETY_POLICY_SETTINGS.driverCancelSignalCount;
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const [row] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM orders
        WHERE driver_id = $1 AND cancelled_by = 'driver' AND cancelled_at >= $2
          AND cancel_reason IS DISTINCT FROM 'no_show'`,
      [driverUserId, startOfDay],
    )) as Array<{ cnt: number }>;
    const count = Number(row?.cnt ?? 0);
    if (count < threshold) return;

    const description = `Bugun ${count} ta qabul qilingan buyurtma bekor qilindi (chegara ${threshold})`;
    const today = await this.incidents.findOne({
      where: { subjectUserId: driverUserId, source: 'driver_cancel_signal', createdAt: MoreThanOrEqual(startOfDay) },
    });
    if (today) {
      if (today.status === IncidentStatus.OPEN || today.status === IncidentStatus.INVESTIGATING) {
        await this.incidents.update(today.id, { description });
      }
      return;
    }
    await this.incidents.save(
      this.incidents.create({
        reporterUserId: null,
        reporterRole: 'system',
        subjectUserId: driverUserId,
        subjectRole: 'driver',
        category: 'driver_cancels',
        description,
        source: 'driver_cancel_signal',
      }),
    );
    this.logger.log(`Driver cancel signal for ${driverUserId}: ${count} today`);
  }

  /**
   * Safar avariya bilan uzildi (§5) — xavfsizlik hodisasi menejer navbatiga.
   * Avtomatik to'xtatish YO'Q (tamoyil 4): avariya haydovchining aybi
   * bo'lmasligi mumkin, odam qaror qiladi.
   */
  async onTripInterrupted(input: {
    orderId: string;
    driverUserId: string | null;
    passengerId: string;
    note: string | null;
    byRole: 'driver' | 'manager';
  }): Promise<void> {
    const existing = await this.incidents.count({
      where: { orderVertical: 'taxi', orderId: input.orderId, source: 'trip_interrupted' },
    });
    if (existing > 0) return;
    await this.incidents.save(
      this.incidents.create({
        reporterUserId: null,
        reporterRole: 'system',
        subjectUserId: input.driverUserId,
        subjectRole: input.driverUserId ? 'driver' : null,
        orderVertical: 'taxi',
        orderId: input.orderId,
        category: 'safety',
        description: `Safar avariya sababli uzildi (${input.byRole === 'driver' ? 'haydovchi' : 'menejer'} belgiladi)${
          input.note ? `: ${input.note}` : ''
        }`.slice(0, 1000),
        source: 'trip_interrupted',
      }),
    );
  }
}
