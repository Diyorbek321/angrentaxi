import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ERROR_CODES, codedNotFound } from '../../common/errors/coded-error';
import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { IntercityRoute } from '../../database/entities/intercity-route.entity';
import { AUDIT_ACTIONS, AuditLogService } from '../audit/audit-log.service';
import { SettingsService } from '../settings/settings.service';
import { IntercityZonesService } from './intercity-zones.service';
import { CreateIntercityRouteDto } from './dto/create-intercity-route.dto';
import { UpdateIntercityRouteDto } from './dto/update-intercity-route.dto';
import { IntercityRoutePrices, assertIntercityRoutePrices } from './intercity-route-policy';
import { IntercityPointsService } from './intercity-points.service';
import { IntercityRouteView, toIntercityRouteView } from './intercity-route-view';

const DEFAULT_SEATS = 4;
const AUDIT_TARGET = 'intercity_route';
const UNIQUE_VIOLATION = '23505';

type RouteWithPoints = IntercityRoute & {
  originPoint: IntercityPoint;
  destinationPoint: IntercityPoint;
};

const pricesOf = (route: IntercityRoutePrices): IntercityRoutePrices => ({
  seatPrice: route.seatPrice,
  wholeCarPrice: route.wholeCarPrice,
  comfortSeatPrice: route.comfortSeatPrice,
  comfortWholeCarPrice: route.comfortWholeCarPrice,
  seatsDefault: route.seatsDefault,
});

/**
 * Shaharlararo yo'nalishlar va ularning qat'iy narxlari.
 *
 * Narx — pul sozlamasi: har bir yaratish/o'zgartirish amallar jurnaliga
 * oldingi va yangi qiymat bilan yoziladi ("kim, qachon Rohat narxini
 * 25 000 dan 20 000 ga tushirdi?" savoliga javob bo'lsin).
 */
@Injectable()
export class IntercityRoutesService {
  constructor(
    @InjectRepository(IntercityRoute)
    private readonly routeRepository: Repository<IntercityRoute>,
    private readonly points: IntercityPointsService,
    private readonly settings: SettingsService,
    private readonly audit: AuditLogService,
    // Ixtiyoriy: tumanlar ommaviy ro'yxatga qo'shiladi (migratsiya 039).
    @Optional() private readonly zones?: IntercityZonesService,
  ) {}

  /**
   * Yo'lovchi/haydovchi ilovasi uchun: faol yo'nalishlar, ikkala uchi ham
   * faol bo'lganlari. Funksiya o'chiq bo'lsa — 404 (`INTERCITY_DISABLED`):
   * ilova kafelni yashiradi, eski versiya esa bo'sh ro'yxatni "yo'nalish
   * yo'q" deb noto'g'ri ko'rsatmaydi.
   */
  async listPublic(): Promise<IntercityRouteView[]> {
    if (!(await this.settings.isIntercityEnabled())) {
      throw codedNotFound(ERROR_CODES.intercityDisabled, "Shaharlararo qatnov hozircha mavjud emas");
    }
    const routes = await this.routeRepository.find({
      where: { isActive: true },
      relations: { originPoint: true, destinationPoint: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const open = routes.filter((route): route is RouteWithPoints =>
      Boolean(route.originPoint?.isActive && route.destinationPoint?.isActive),
    );
    const pointIds = [...new Set(open.flatMap((route) => [route.originPointId, route.destinationPointId]))];
    const zones = this.zones ? await this.zones.listActiveForPoints(pointIds) : [];
    return open.map((route) => toIntercityRouteView(route, zones));
  }

  /** Admin paneli uchun — nofaollari va nuqtalari bilan. */
  async findAll(): Promise<IntercityRoute[]> {
    return this.routeRepository.find({
      relations: { originPoint: true, destinationPoint: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(actorUserId: string, dto: CreateIntercityRouteDto): Promise<IntercityRoute> {
    if (dto.originPointId === dto.destinationPointId) {
      throw new BadRequestException("Jo'nash va borish nuqtasi bir xil bo'lishi mumkin emas");
    }
    const [origin, destination] = await Promise.all([
      this.points.getActiveOrThrow(dto.originPointId),
      this.points.getActiveOrThrow(dto.destinationPointId),
    ]);
    const prices: IntercityRoutePrices = {
      seatPrice: dto.seatPrice,
      wholeCarPrice: dto.wholeCarPrice,
      comfortSeatPrice: dto.comfortSeatPrice ?? null,
      comfortWholeCarPrice: dto.comfortWholeCarPrice ?? null,
      seatsDefault: dto.seatsDefault ?? DEFAULT_SEATS,
    };
    assertIntercityRoutePrices(prices);

    const duplicate = await this.routeRepository.findOne({
      where: { originPointId: origin.id, destinationPointId: destination.id },
    });
    if (duplicate) throw this.duplicateError(origin, destination);

    const saved = await this.saveOrConflict(
      this.routeRepository.create({
        originPointId: origin.id,
        destinationPointId: destination.id,
        ...prices,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      }),
      () => this.duplicateError(origin, destination),
    );
    await this.audit.record({
      actorUserId,
      action: AUDIT_ACTIONS.intercityRouteCreate,
      targetType: AUDIT_TARGET,
      targetId: saved.id,
      note: `${origin.name} → ${destination.name}`,
      metadata: { prices, isActive: saved.isActive },
    });
    return saved;
  }

  /**
   * Faqat yuborilgan maydonlar o'zgaradi, lekin qoida BIRLASHTIRILGAN
   * natijaga qo'llanadi: "faqat o'rindiq narxini 200 000 qilish" butun
   * mashinadan qimmat o'rindiqqa olib kelsa — rad etiladi.
   */
  async update(
    actorUserId: string,
    id: string,
    dto: UpdateIntercityRouteDto,
  ): Promise<IntercityRoute> {
    const existing = await this.routeRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Shaharlararo yo'nalish topilmadi");
    }
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as Partial<IntercityRoute>;
    const merged: IntercityRoute = { ...existing, ...changes };
    assertIntercityRoutePrices(pricesOf(merged));

    const saved = await this.routeRepository.save(merged);
    await this.audit.record({
      actorUserId,
      action: AUDIT_ACTIONS.intercityRouteUpdate,
      targetType: AUDIT_TARGET,
      targetId: id,
      metadata: {
        before: { ...pricesOf(existing), isActive: existing.isActive },
        after: { ...pricesOf(merged), isActive: merged.isActive },
      },
    });
    return saved;
  }

  private duplicateError(origin: IntercityPoint, destination: IntercityPoint): ConflictException {
    return new ConflictException(`${origin.name} → ${destination.name} yo'nalishi allaqachon bor`);
  }

  /** Oldindan tekshiruv va saqlash orasidagi poyga: unikal indeks 23505 → 409. */
  private async saveOrConflict(
    route: IntercityRoute,
    conflict: () => ConflictException,
  ): Promise<IntercityRoute> {
    try {
      return await this.routeRepository.save(route);
    } catch (error) {
      const code = (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
      if (error instanceof QueryFailedError && code === UNIQUE_VIOLATION) throw conflict();
      throw error;
    }
  }
}
