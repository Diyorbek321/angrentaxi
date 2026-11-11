import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { DriverBonusesService } from '../driver-bonuses/driver-bonuses.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { assessTrip, FraudAssessment, FraudSignal } from './fraud-rules';
import { creditReferralBonus } from './referral-bonus';

/** Menejer navbatidagi bitta shubhali safar. */
export interface FraudReviewEntry {
  orderId: string;
  completedAt: string | null;
  finalPrice: number | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  distanceKm: number | null;
  durationMin: number | null;
  signals: FraudSignal[];
  passengerName: string | null;
  passengerPhone: string | null;
  driverName: string | null;
  driverPhone: string | null;
  /** Shu juftlikning jami tugagan safarlari — menejer qaror qilishi uchun. */
  pairTripsTotal: number;
}

interface FactsRow {
  passenger_id: string;
  driver_id: string | null;
  passenger_device_id: string | null;
  driver_device_id: string | null;
  accept_distance_m: number | null;
  distance_km: string | null;
  duration_min: number | null;
  age_days: string;
  pair_7d: string;
  passenger_trips: string;
  pair_trips: string;
}

/**
 * O'zini o'zi zakaz qilishni aniqlash: dalillarni yig'adi, qoidani
 * (`fraud-rules.ts`) qo'llaydi va menejer qarorini bajaradi.
 *
 * Hammasi xom SQL: ustunlar `select: false` (order.entity.ts izohi) va
 * hisob-kitob bitta so'rovda yig'iladi.
 */
@Injectable()
export class OrderFraudService {
  private readonly logger = new Logger(OrderFraudService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly driverBonusesService: DriverBonusesService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /** Buyurtma berilgan telefon. */
  async recordPassengerDevice(orderId: string, deviceId: string | null): Promise<void> {
    if (!deviceId) return;
    await this.orderRepository.query(
      `UPDATE orders SET passenger_device_id = $2 WHERE id = $1`,
      [orderId, deviceId],
    );
  }

  /** Qabul qilgan telefon va haydovchi o'sha paytda olish nuqtasidan qancha uzoqda edi. */
  async recordDriverAccept(orderId: string, driverUserId: string, deviceId: string | null): Promise<void> {
    await this.orderRepository.query(
      `UPDATE orders o
          SET driver_device_id = COALESCE($2, o.driver_device_id),
              accept_distance_m = (
                SELECT ROUND(ST_Distance(d.current_location::geography, o.pickup_location::geography))::int
                  FROM drivers d
                 WHERE d.user_id = $3 AND d.current_location IS NOT NULL
              )
        WHERE o.id = $1`,
      [orderId, deviceId, driverUserId],
    );
  }

  /**
   * Tugagan safarni baholaydi va natijani yozadi. Shubhali bo'lsa
   * menejerlarga jonli xabar ketadi.
   *
   * ⚠️ Bonus hisobidan OLDIN chaqirilishi shart (`orders-completion`): aks
   * holda bonus allaqachon berilib bo'lardi.
   */
  async assessCompleted(orderId: string): Promise<FraudAssessment> {
    const [row] = (await this.orderRepository.query(
      `SELECT o.passenger_id, o.driver_id, o.passenger_device_id, o.driver_device_id,
              o.accept_distance_m,
              t.actual_distance_km AS distance_km,
              t.actual_duration_min AS duration_min,
              EXTRACT(EPOCH FROM (now() - u.created_at)) / 86400 AS age_days,
              (SELECT count(*) FROM orders x
                WHERE x.passenger_id = o.passenger_id AND x.driver_id = o.driver_id
                  AND x.status = 'completed' AND x.completed_at >= now() - interval '7 days') AS pair_7d,
              (SELECT count(*) FROM orders x
                WHERE x.passenger_id = o.passenger_id AND x.status = 'completed') AS passenger_trips,
              (SELECT count(*) FROM orders x
                WHERE x.passenger_id = o.passenger_id AND x.driver_id = o.driver_id
                  AND x.status = 'completed') AS pair_trips
         FROM orders o
         JOIN users u ON u.id = o.passenger_id
         LEFT JOIN trips t ON t.order_id = o.id
        WHERE o.id = $1`,
      [orderId],
    )) as FactsRow[];
    if (!row || !row.driver_id) return { signals: [], flagged: false };

    const assessment = assessTrip({
      sameDevice:
        row.passenger_device_id != null && row.passenger_device_id === row.driver_device_id,
      acceptDistanceM: row.accept_distance_m,
      pairTripsLast7Days: Number(row.pair_7d),
      passengerAccountAgeDays: Number(row.age_days),
      passengerCompletedTrips: Number(row.passenger_trips),
      passengerTripsWithThisDriver: Number(row.pair_trips),
      distanceKm: row.distance_km == null ? null : Number(row.distance_km),
      durationMin: row.duration_min,
    });

    await this.orderRepository.query(
      `UPDATE orders SET fraud_signals = $2::jsonb, fraud_review = $3 WHERE id = $1`,
      [orderId, JSON.stringify(assessment.signals), assessment.flagged ? 'pending' : null],
    );

    if (assessment.flagged) {
      this.logger.warn(`Order ${orderId} shubhali: ${assessment.signals.join(', ')}`);
      this.realtimeGateway.emitToManagers('order:fraud_flagged', {
        orderId,
        signals: assessment.signals,
      });
    }
    return assessment;
  }

  /** Menejer navbati — eng eskisi birinchi. */
  async listPending(): Promise<FraudReviewEntry[]> {
    const rows = (await this.orderRepository.query(
      `SELECT o.id, o.completed_at, o.final_price, o.pickup_address, o.dropoff_address,
              o.fraud_signals,
              t.actual_distance_km, t.actual_duration_min,
              NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), '') AS passenger_name, p.phone AS passenger_phone,
              NULLIF(TRIM(CONCAT(d.first_name, ' ', d.last_name)), '') AS driver_name, d.phone AS driver_phone,
              (SELECT count(*) FROM orders x
                WHERE x.passenger_id = o.passenger_id AND x.driver_id = o.driver_id
                  AND x.status = 'completed') AS pair_trips
         FROM orders o
         JOIN users p ON p.id = o.passenger_id
         LEFT JOIN users d ON d.id = o.driver_id
         LEFT JOIN trips t ON t.order_id = o.id
        WHERE o.fraud_review = 'pending'
        ORDER BY o.completed_at ASC
        LIMIT 200`,
    )) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      orderId: r.id as string,
      completedAt: r.completed_at ? new Date(r.completed_at as string).toISOString() : null,
      finalPrice: r.final_price == null ? null : Number(r.final_price),
      pickupAddress: (r.pickup_address as string | null) ?? null,
      dropoffAddress: (r.dropoff_address as string | null) ?? null,
      distanceKm: r.actual_distance_km == null ? null : Number(r.actual_distance_km),
      durationMin: (r.actual_duration_min as number | null) ?? null,
      signals: (r.fraud_signals as FraudSignal[]) ?? [],
      passengerName: (r.passenger_name as string | null) ?? null,
      passengerPhone: (r.passenger_phone as string | null) ?? null,
      driverName: (r.driver_name as string | null) ?? null,
      driverPhone: (r.driver_phone as string | null) ?? null,
      pairTripsTotal: Number(r.pair_trips),
    }));
  }

  /**
   * Menejer qarori. Tasdiqlansa — safar toza hisoblanadi: haydovchi bonuslari
   * qayta hisoblanadi va ushlab qolingan referal bonusi beriladi. Rad etilsa
   * — safar bonus hisobiga hech qachon kirmaydi (haydovchini bloklash alohida
   * qaror, menejer "Haydovchilar" bo'limida qiladi).
   */
  async review(orderId: string, reviewerId: string, approved: boolean, note?: string): Promise<void> {
    const result: unknown = await this.orderRepository.query(
      `UPDATE orders
          SET fraud_review = $2, fraud_reviewed_by = $3, fraud_reviewed_at = now(), fraud_note = $4
        WHERE id = $1 AND fraud_review = 'pending'
        RETURNING driver_id, passenger_id`,
      [orderId, approved ? 'approved' : 'rejected', reviewerId, note?.trim() || null],
    );
    const row = returningRows<{ driver_id: string | null; passenger_id: string }>(result)[0];
    if (!row) {
      throw new BadRequestException("Bu safar ko'rib chiqilmaydi yoki allaqachon ko'rib chiqilgan");
    }
    if (!approved) return;

    try {
      if (row.driver_id) await this.driverBonusesService.evaluateForDriver(row.driver_id);
      await creditReferralBonus(this.orderRepository, row.passenger_id, orderId);
    } catch (err) {
      // Qaror saqlandi; bonus — best-effort, keyingi safarda baribir qayta hisoblanadi.
      this.logger.warn(`Bonus release after fraud approval failed for ${orderId}: ${err}`);
    }
  }
}

/**
 * `UPDATE ... RETURNING` natijasi: pg drayveri TypeORM orqali `[rows, count]`
 * qaytaradi, SELECT esa oddiy massiv — ikkalasini bir xil o'qiymiz.
 */
function returningRows<T>(result: unknown): T[] {
  if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') {
    return result[0] as T[];
  }
  return Array.isArray(result) ? (result as T[]) : [];
}
