import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ERROR_CODES, codedNotFound } from '../../common/errors/coded-error';
import { Driver } from '../../database/entities/driver.entity';
import { IntercityTrip, IntercityTripStatus } from '../../database/entities/intercity-trip.entity';
import { OrderStatus } from '../../database/entities/order.entity';
import { SettingsService } from '../settings/settings.service';
import { IntercityDetourService, LatLng } from './intercity-detour.service';
import { returnedRows } from './intercity-seat-ledger';

export type RoutePlanPhase = 'pickup' | 'dropoff' | 'done';

export interface RoutePlanStopView {
  /** 1, 2, 3 — haydovchi kartalarda ko'radigan tartib raqami. */
  sequence: number;
  orderId: string;
  kind: 'pickup' | 'dropoff';
  address: string | null;
  lat: number;
  lng: number;
  /** Oldingi bekatdan (birinchisi — haydovchi joyidan yoki nuqtadan) daqiqa; noma'lum — null. */
  etaMinutesFromPrev: number | null;
}

export interface IntercityRoutePlanView {
  phase: RoutePlanPhase;
  /** Olishda — yig'ilish nuqtasi (oxirgi bekat); tushirishda — boshlanish. */
  point: { name: string; lat: number; lng: number };
  stops: RoutePlanStopView[];
  /** Olishda: oxirgi yo'lovchidan nuqtagacha daqiqa. */
  terminalEtaMinutes: number | null;
  totalMinutes: number | null;
  /** false — marshrut xizmatisiz "eng yaqindan" tartib. */
  optimized: boolean;
}

/** Hali olinmagan yo'lovchilar (yetib kelinganlari allaqachon mashinada). */
const PICKUP_PENDING_STATUSES: readonly OrderStatus[] = [OrderStatus.SCHEDULED, OrderStatus.ACCEPTED];
const PICKUP_PHASE: readonly IntercityTripStatus[] = [
  IntercityTripStatus.OPEN,
  IntercityTripStatus.FULL,
  IntercityTripStatus.BOARDING,
];

interface StopRow {
  id: string;
  address: string | null;
  lat: number | string;
  lng: number | string;
}

/**
 * Haydovchi uchun bekatlar tartibi: kimni birinchi olish va kimni birinchi
 * tushirish — eng qisqa yo'l bo'yicha (`intercity-route-optimizer.ts`).
 *
 *  · open/full/boarding — olish: yo'lovchilar uylaridan, oxiri boshlanish
 *    nuqtasida (Toshkent → Angren: shahar ichida yig'ib, Rohat krugiga);
 *  · in_progress — tushirish: manzil nuqtasidan boshlab uylarga.
 */
@Injectable()
export class IntercityRoutePlanService {
  constructor(
    private readonly settings: SettingsService,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(IntercityTrip)
    private readonly tripRepository: Repository<IntercityTrip>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly detour: IntercityDetourService,
  ) {}

  async planForDriver(userId: string, tripId: string, from?: LatLng): Promise<IntercityRoutePlanView> {
    if (!(await this.settings.isIntercityEnabled())) {
      throw codedNotFound(ERROR_CODES.intercityDisabled, 'Shaharlararo qatnov hozircha mavjud emas');
    }
    const driver = await this.driverRepository.findOne({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    const trip = await this.tripRepository.findOne({
      where: { id: tripId, driverId: driver.id },
      relations: { route: { originPoint: true, destinationPoint: true } },
    });
    if (!trip?.route?.originPoint || !trip.route.destinationPoint) {
      throw codedNotFound(ERROR_CODES.intercityTripNotFound, 'Qatnov topilmadi');
    }

    const phase: RoutePlanPhase = PICKUP_PHASE.includes(trip.status)
      ? 'pickup'
      : trip.status === IntercityTripStatus.IN_PROGRESS
        ? 'dropoff'
        : 'done';
    const anchor = phase === 'dropoff' ? trip.route.destinationPoint : trip.route.originPoint;
    const point = { name: anchor.name, lat: anchor.centerLat, lng: anchor.centerLng };
    if (phase === 'done') {
      return { phase, point, stops: [], terminalEtaMinutes: null, totalMinutes: 0, optimized: true };
    }

    const rows = await this.stopRows(tripId, phase);
    const stops = rows.map((row) => ({ id: row.id, lat: Number(row.lat), lng: Number(row.lng) }));
    const plan = await this.detour.plan(phase, { lat: point.lat, lng: point.lng }, stops, phase === 'pickup' ? from : undefined);
    const byId = new Map(rows.map((row) => [row.id, row]));
    return {
      phase,
      point,
      stops: plan.stops.map((stop, index) => {
        const row = byId.get(stop.id)!;
        return {
          sequence: index + 1,
          orderId: stop.id,
          kind: phase,
          address: row.address,
          lat: Number(row.lat),
          lng: Number(row.lng),
          etaMinutesFromPrev: stop.etaMinutesFromPrev,
        };
      }),
      terminalEtaMinutes: plan.terminalEtaMinutes,
      totalMinutes: plan.totalMinutes,
      optimized: plan.optimized,
    };
  }

  private async stopRows(tripId: string, phase: 'pickup' | 'dropoff'): Promise<StopRow[]> {
    const statuses = phase === 'pickup' ? PICKUP_PENDING_STATUSES : [OrderStatus.IN_PROGRESS];
    const column = phase === 'pickup' ? 'pickup' : 'dropoff';
    return returnedRows<StopRow>(
      await this.dataSource.query(
        `SELECT o."id", o."${column}_address" AS address,
                ST_Y(o."${column}_location"::geometry) AS lat,
                ST_X(o."${column}_location"::geometry) AS lng
           FROM "orders" o
          WHERE o."intercity_trip_id" = $1 AND o."status"::text = ANY($2::text[])
          ORDER BY o."created_at" ASC`,
        [tripId, statuses],
      ),
    );
  }
}
