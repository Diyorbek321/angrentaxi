import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { REDIS_CLIENT } from '../../config/redis.config';
import { Driver } from '../../database/entities/driver.entity';
import { ServiceType } from '../../database/entities/order.entity';
import { resolveDriverServiceTypes } from '../drivers/driver-capabilities';
import { DRIVERS_ONLINE_KEY, DRIVER_PRESENCE_PREFIX } from '../drivers/driver-presence.keys';

/** Where an eligible taxi driver stands. */
export interface DriverPosition {
  lat: number;
  lng: number;
}


interface EligibilityRow {
  id: string;
  service_types: ServiceType[] | null;
}

/**
 * Surge'ning taklif tomoni — HOZIR taksi buyurtmasini ola oladigan
 * haydovchilar.
 *
 * Ilgari taklif `drivers:online` geo-to'plamining xom soni edi. U to'plam
 * faqat "onlayn" ni biladi: kuryer, yuk furgoni, bloklangan va telefoni
 * o'chgan (mavjudlik kaliti tugagan) haydovchi ham taksi taklifi bo'lib
 * sanalardi — ya'ni surge hudud aslida bo'sh paytda ham past chiqardi.
 *
 * Endi matching qo'llaydigan shartlar bilan bir xil: mavjudlik kaliti tirik,
 * `is_online`, foydalanuvchi `active`, xizmatlari orasida taksi bor
 * (`resolveDriverServiceTypes` — bo'sh ro'yxat taksi deb o'qiladi).
 *
 * ⚠️ Band (safardagi) haydovchi ATAYLAB sanaladi — ikki ko'cha naridagi
 * safarni tugatayotgan haydovchi haqiqiy, yaqin taklif.
 *
 * Faqat O'QIYDI: eskirgan a'zolarni geo-to'plamdan tozalash matching'ning
 * ishi (`DriversService.filterPresent`).
 */
@Injectable()
export class TaxiSupplyService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(Driver) private readonly driverRepository: Repository<Driver>,
  ) {}

  /**
   * Eligible taxi drivers within [radiusKm] of a point, with positions — so a
   * whole demand map is served by ONE read and counted per cell in memory.
   * Errors propagate: the caller treats them as "no data" (surge 1.0).
   */
  async positionsNear(lat: number, lng: number, radiusKm: number): Promise<DriverPosition[]> {
    const raw = (await this.redis.georadius(DRIVERS_ONLINE_KEY, lng, lat, radiusKm, 'km', 'WITHCOORD')) ?? [];
    const hits = raw.map((entry) => {
      const [id, [hitLng, hitLat]] = entry as [string, [string, string]];
      return { id, lat: parseFloat(hitLat), lng: parseFloat(hitLng) };
    });
    if (hits.length === 0) return [];

    const flags = await this.redis.mget(...hits.map((h) => `${DRIVER_PRESENCE_PREFIX}${h.id}`));
    const present = hits.filter((_, index) => flags[index] !== null);
    if (present.length === 0) return [];

    const rows: EligibilityRow[] = await this.driverRepository.query(
      `SELECT d.id, d.service_types
         FROM drivers d
         JOIN users u ON u.id = d.user_id
        WHERE d.id = ANY($1)
          AND d.is_online = true
          AND u.status = 'active'`,
      [present.map((h) => h.id)],
    );
    const eligible = new Set(
      rows
        .filter((row) => resolveDriverServiceTypes(row.service_types).includes(ServiceType.TAXI))
        .map((row) => row.id),
    );

    return present.filter((h) => eligible.has(h.id)).map(({ lat: hLat, lng: hLng }) => ({ lat: hLat, lng: hLng }));
  }
}
