import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../common/errors/coded-error';
import { IntercityPoint } from '../../database/entities/intercity-point.entity';
import { IntercityRoute } from '../../database/entities/intercity-route.entity';
import { AUDIT_ACTIONS } from '../audit/audit-log.service';
import { IntercityPointsService } from './intercity-points.service';
import { IntercityRoutesService } from './intercity-routes.service';

/**
 * Yo'nalishlar va nuqtalar. Repozitoriylar xotiradagi soxta — so'rov shakli
 * emas, natija tekshiriladi.
 */
describe('IntercityRoutesService', () => {
  const ADMIN = 'admin-1';

  let points: IntercityPoint[];
  let routes: IntercityRoute[];
  let enabled: boolean;
  let audit: { record: jest.Mock };
  let pointsService: IntercityPointsService;
  let service: IntercityRoutesService;

  const point = (id: string, name: string, overrides: Partial<IntercityPoint> = {}): IntercityPoint =>
    ({
      id,
      name,
      centerLat: 40,
      centerLng: 70,
      radiusKm: 10,
      isActive: true,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as IntercityPoint;

  const withPoints = (route: IntercityRoute): IntercityRoute => ({
    ...route,
    originPoint: points.find((p) => p.id === route.originPointId),
    destinationPoint: points.find((p) => p.id === route.destinationPointId),
  });

  const ROUTE_DTO = {
    originPointId: 'angren',
    destinationPointId: 'rohat',
    seatPrice: 25000,
    wholeCarPrice: 100000,
    comfortSeatPrice: 30000,
    comfortWholeCarPrice: 120000,
  };

  beforeEach(() => {
    points = [point('angren', 'Angren'), point('rohat', 'Rohat krugi (Toshkent)'), point('olmaliq', 'Olmaliq')];
    routes = [];
    enabled = true;
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const pointRepo = {
      find: jest.fn(async () => [...points]),
      findOne: jest.fn(async ({ where }: { where: { id: string } }) => points.find((p) => p.id === where.id) ?? null),
      create: jest.fn((value: Partial<IntercityPoint>) => ({ ...value })),
      save: jest.fn(async (value: IntercityPoint) => {
        const saved = { ...value, id: value.id ?? `p${points.length + 1}` };
        points = [...points.filter((p) => p.id !== saved.id), saved];
        return saved;
      }),
    };
    const routeRepo = {
      find: jest.fn(async ({ where }: { where?: { isActive?: boolean } } = {}) =>
        routes.filter((r) => where?.isActive === undefined || r.isActive === where.isActive).map(withPoints),
      ),
      findOne: jest.fn(async ({ where }: { where: { id?: string; originPointId?: string; destinationPointId?: string } }) => {
        const found = routes.find((r) =>
          where.id !== undefined
            ? r.id === where.id
            : r.originPointId === where.originPointId && r.destinationPointId === where.destinationPointId,
        );
        return found ? withPoints(found) : null;
      }),
      create: jest.fn((value: Partial<IntercityRoute>) => ({ ...value })),
      save: jest.fn(async (value: IntercityRoute) => {
        const saved = { ...value, id: value.id ?? `r${routes.length + 1}` };
        routes = [...routes.filter((r) => r.id !== saved.id), saved];
        return saved;
      }),
    };
    const settings = { isIntercityEnabled: jest.fn(async () => enabled) };

    pointsService = new IntercityPointsService(pointRepo as never);
    service = new IntercityRoutesService(routeRepo as never, pointsService, settings as never, audit as never);
  });

  describe('create', () => {
    it("yo'nalish yaratiladi va narx amallar jurnaliga yoziladi", async () => {
      const route = await service.create(ADMIN, ROUTE_DTO);

      expect(route).toMatchObject({
        originPointId: 'angren',
        destinationPointId: 'rohat',
        seatPrice: 25000,
        wholeCarPrice: 100000,
        comfortSeatPrice: 30000,
        comfortWholeCarPrice: 120000,
        seatsDefault: 4,
        isActive: true,
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: ADMIN,
          action: AUDIT_ACTIONS.intercityRouteCreate,
          targetType: 'intercity_route',
          targetId: route.id,
        }),
      );
    });

    it("komfortsiz yo'nalish (komfort narxlari berilmagan) — null juftlik", async () => {
      const route = await service.create(ADMIN, {
        originPointId: 'angren',
        destinationPointId: 'olmaliq',
        seatPrice: 15000,
        wholeCarPrice: 60000,
      });
      expect(route).toMatchObject({ comfortSeatPrice: null, comfortWholeCarPrice: null });
    });

    it('teskari yo‘nalish alohida qator (Toshkent → Angren)', async () => {
      await service.create(ADMIN, ROUTE_DTO);
      await expect(
        service.create(ADMIN, { ...ROUTE_DTO, originPointId: 'rohat', destinationPointId: 'angren' }),
      ).resolves.toMatchObject({ originPointId: 'rohat', destinationPointId: 'angren' });
    });

    it('xuddi shu yo‘nalish ikkinchi marta — 409', async () => {
      await service.create(ADMIN, ROUTE_DTO);
      await expect(service.create(ADMIN, ROUTE_DTO)).rejects.toBeInstanceOf(ConflictException);
    });

    it('bir xil nuqta ikki uchda — 400', async () => {
      await expect(
        service.create(ADMIN, { ...ROUTE_DTO, destinationPointId: 'angren' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("mavjud bo'lmagan nuqta — 404", async () => {
      await expect(
        service.create(ADMIN, { ...ROUTE_DTO, destinationPointId: 'yoq' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('faol emas nuqta — 400', async () => {
      points = points.map((p) => (p.id === 'rohat' ? { ...p, isActive: false } : p));
      await expect(service.create(ADMIN, ROUTE_DTO)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("narx qoidasi buzilsa — INTERCITY_ROUTE_INVALID, hech narsa saqlanmaydi", async () => {
      await expect(service.create(ADMIN, { ...ROUTE_DTO, wholeCarPrice: 1000 })).rejects.toMatchObject({
        response: expect.objectContaining({ code: ERROR_CODES.intercityRouteInvalid }),
      });
      expect(routes).toEqual([]);
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it("birlashtirilgan natija qoidadan o'tadi: faqat komfortni olib tashlash mumkin", async () => {
      const route = await service.create(ADMIN, ROUTE_DTO);
      const updated = await service.update(ADMIN, route.id, {
        comfortSeatPrice: null,
        comfortWholeCarPrice: null,
      });
      expect(updated).toMatchObject({ seatPrice: 25000, comfortSeatPrice: null, comfortWholeCarPrice: null });
    });

    it("yarim komfort (faqat bittasini null) — rad etiladi, eski narx o'zgarmaydi", async () => {
      const route = await service.create(ADMIN, ROUTE_DTO);
      await expect(service.update(ADMIN, route.id, { comfortSeatPrice: null })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(routes[0].comfortSeatPrice).toBe(30000);
    });

    it("o'rindiqni butun mashinadan qimmat qilish — rad etiladi", async () => {
      const route = await service.create(ADMIN, ROUTE_DTO);
      await expect(service.update(ADMIN, route.id, { seatPrice: 200000 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('narx o‘zgarishi jurnalga oldingi va yangi qiymat bilan yoziladi', async () => {
      const route = await service.create(ADMIN, ROUTE_DTO);
      audit.record.mockClear();
      await service.update(ADMIN, route.id, { seatPrice: 27000 });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.intercityRouteUpdate,
          targetId: route.id,
          metadata: expect.objectContaining({
            before: expect.objectContaining({ seatPrice: 25000 }),
            after: expect.objectContaining({ seatPrice: 27000 }),
          }),
        }),
      );
    });

    it("o'chirish o'rniga isActive=false", async () => {
      const route = await service.create(ADMIN, ROUTE_DTO);
      await expect(service.update(ADMIN, route.id, { isActive: false })).resolves.toMatchObject({
        isActive: false,
      });
      expect(routes).toHaveLength(1);
    });

    it("yo'q yo'nalish — 404", async () => {
      await expect(service.update(ADMIN, 'yoq', { seatPrice: 1 })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listPublic', () => {
    it("o'chiq bo'lsa — INTERCITY_DISABLED (404)", async () => {
      enabled = false;
      await expect(service.listPublic()).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({ code: ERROR_CODES.intercityDisabled }),
      });
    });

    it('faqat faol yo‘nalishlar, ikkala nuqtasi ham faol bo‘lganlari', async () => {
      await service.create(ADMIN, ROUTE_DTO);
      const toOlmaliq = await service.create(ADMIN, {
        originPointId: 'angren',
        destinationPointId: 'olmaliq',
        seatPrice: 15000,
        wholeCarPrice: 60000,
      });
      await service.update(ADMIN, toOlmaliq.id, { isActive: false });
      await service.create(ADMIN, {
        ...ROUTE_DTO,
        originPointId: 'rohat',
        destinationPointId: 'angren',
      });
      // O'chirilgan yo'nalish (Olmaliq) ko'rinmaydi.
      expect((await service.listPublic()).map((r) => r.destination.name).sort()).toEqual([
        'Angren',
        'Rohat krugi (Toshkent)',
      ]);

      // Rohat nuqtasi o'chirildi — unga boradigan ham, undan keladigan ham yashiriladi.
      points = points.map((p) => (p.id === 'rohat' ? { ...p, isActive: false } : p));
      expect(await service.listPublic()).toEqual([]);
    });

    it("ommaviy ko'rinish: nuqta nomi va koordinatasi, narxlar, komfort guruhi", async () => {
      await service.create(ADMIN, ROUTE_DTO);
      const [view] = await service.listPublic();
      expect(view).toEqual({
        id: expect.any(String),
        origin: { id: 'angren', name: 'Angren', centerLat: 40, centerLng: 70, radiusKm: 10 },
        destination: { id: 'rohat', name: 'Rohat krugi (Toshkent)', centerLat: 40, centerLng: 70, radiusKm: 10 },
        seatPrice: 25000,
        wholeCarPrice: 100000,
        comfort: { seatPrice: 30000, wholeCarPrice: 120000 },
        seatsDefault: 4,
      });
    });
  });
});

describe('IntercityPointsService', () => {
  let points: IntercityPoint[];
  let service: IntercityPointsService;

  beforeEach(() => {
    points = [];
    const repo = {
      find: jest.fn(async () => [...points]),
      findOne: jest.fn(async ({ where }: { where: { id: string } }) => points.find((p) => p.id === where.id) ?? null),
      create: jest.fn((value: Partial<IntercityPoint>) => ({ ...value })),
      save: jest.fn(async (value: IntercityPoint) => {
        const saved = { ...value, id: value.id ?? `p${points.length + 1}` };
        points = [...points.filter((p) => p.id !== saved.id), saved];
        return saved;
      }),
    };
    service = new IntercityPointsService(repo as never);
  });

  it('nuqta yaratiladi, standart faol', async () => {
    await expect(
      service.create({ name: 'Angren', centerLat: 40.0956, centerLng: 70.9432, radiusKm: 12 }),
    ).resolves.toMatchObject({ name: 'Angren', isActive: true, sortOrder: 0 });
  });

  it('yangilash faqat yuborilgan maydonlarni o‘zgartiradi', async () => {
    const created = await service.create({ name: 'Rohat', centerLat: 41.3, centerLng: 69.2, radiusKm: 25 });
    await expect(service.update(created.id, { radiusKm: 3 })).resolves.toMatchObject({
      name: 'Rohat',
      radiusKm: 3,
    });
  });

  it("yo'q nuqta — 404", async () => {
    await expect(service.update('yoq', { radiusKm: 3 })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getActiveOrThrow('yoq')).rejects.toBeInstanceOf(NotFoundException);
  });
});
