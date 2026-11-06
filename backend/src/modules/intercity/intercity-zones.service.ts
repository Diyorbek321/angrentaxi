import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ERROR_CODES, codedBadRequest } from '../../common/errors/coded-error';
import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { IntercityTripZone, IntercityZoneSide } from '../../database/entities/intercity-trip-zone.entity';
import { IntercityZone } from '../../database/entities/intercity-zone.entity';
import { CreateIntercityZoneDto } from './dto/create-intercity-zone.dto';
import { UpdateIntercityZoneDto } from './dto/update-intercity-zone.dto';
import { evaluateZoneInput } from './intercity-zone-policy';

/** Qatnovning ikkala tomoni bo'yicha tanlangan tumanlar. Bo'sh — butun davom hududi. */
export interface TripZones {
  origin: IntercityZone[];
  destination: IntercityZone[];
}

const EMPTY_TRIP_ZONES = (): TripZones => ({ origin: [], destination: [] });

/**
 * Tumanlar (migratsiya 039) — "shahar ichiga davom" hududining bo'laklari.
 * O'chirilmaydi, faqat `isActive = false` (qatnovlar tarixi FK bilan bog'langan).
 */
@Injectable()
export class IntercityZonesService {
  constructor(
    @InjectRepository(IntercityZone)
    private readonly zoneRepository: Repository<IntercityZone>,
    @InjectRepository(IntercityPoint)
    private readonly pointRepository: Repository<IntercityPoint>,
    @InjectRepository(IntercityTripZone)
    private readonly tripZoneRepository: Repository<IntercityTripZone>,
  ) {}

  /** Admin: nuqtaning barcha tumanlari, nofaollari bilan. */
  listForPoint(pointId: string): Promise<IntercityZone[]> {
    return this.zoneRepository.find({ where: { pointId }, order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  /** E'lon/qidiruv: berilgan nuqtalarning FAOL tumanlari. */
  listActiveForPoints(pointIds: readonly string[]): Promise<IntercityZone[]> {
    if (pointIds.length === 0) return Promise.resolve([]);
    return this.zoneRepository.find({
      where: { pointId: In([...pointIds]), isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async create(pointId: string, dto: CreateIntercityZoneDto): Promise<IntercityZone> {
    const point = await this.pointRepository.findOne({ where: { id: pointId } });
    if (!point) throw new NotFoundException('Shaharlararo nuqta topilmadi');
    const zone = {
      pointId,
      name: dto.name.trim(),
      centerLat: dto.centerLat,
      centerLng: dto.centerLng,
      radiusKm: dto.radiusKm,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    };
    this.assertValid(zone);
    return this.saveUnique(this.zoneRepository.create(zone));
  }

  async update(id: string, dto: UpdateIntercityZoneDto): Promise<IntercityZone> {
    const existing = await this.zoneRepository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Tuman topilmadi');
    const changes = Object.fromEntries(
      Object.entries({ ...dto, name: dto.name?.trim() }).filter(([, value]) => value !== undefined),
    );
    const merged = { ...existing, ...changes };
    this.assertValid(merged);
    return this.saveUnique(merged);
  }

  /** Qatnovlar → tanlangan tumanlar (bitta so'rov). */
  async zonesOfTrips(tripIds: readonly string[]): Promise<Map<string, TripZones>> {
    const result = new Map<string, TripZones>();
    if (tripIds.length === 0) return result;
    for (const tripId of tripIds) result.set(tripId, EMPTY_TRIP_ZONES());
    const rows = await this.tripZoneRepository.find({
      where: { tripId: In([...tripIds]) },
      relations: { zone: true },
    });
    for (const row of rows) {
      if (!row.zone) continue;
      const bucket = result.get(row.tripId) ?? EMPTY_TRIP_ZONES();
      (row.side === IntercityZoneSide.ORIGIN ? bucket.origin : bucket.destination).push(row.zone);
      result.set(row.tripId, bucket);
    }
    return result;
  }

  async zonesOfTrip(tripId: string): Promise<TripZones> {
    return (await this.zonesOfTrips([tripId])).get(tripId) ?? EMPTY_TRIP_ZONES();
  }

  private assertValid(zone: { name?: string; radiusKm?: number }): void {
    const reasons = evaluateZoneInput(zone);
    if (reasons.length > 0) {
      throw codedBadRequest(ERROR_CODES.intercityPointInvalid, reasons.map((r) => r.message).join('; '), { reasons });
    }
  }

  private async saveUnique(zone: IntercityZone | Omit<IntercityZone, 'id' | 'createdAt' | 'updatedAt'>): Promise<IntercityZone> {
    try {
      return await this.zoneRepository.save(zone as IntercityZone);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException('Bu nuqtada shu nomli tuman allaqachon bor');
      }
      throw err;
    }
  }
}
