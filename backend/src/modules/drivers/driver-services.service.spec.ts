import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { DriverServicesService } from './driver-services.service';
import { DriverVerificationService } from './driver-verification.service';
import { driverMatchesCapabilities } from './driver-capabilities';
import { DriverVerificationKind } from '../../database/entities/driver-verification-requirement.entity';
import { DriverVerificationReviewStatus } from '../../database/entities/driver-verification-submission.entity';
import { OrderStatus, ServiceType } from '../../database/entities/order.entity';
import { VehicleType } from '../../database/entities/tariff.entity';

/**
 * Haydovchi xizmat turlarini tanlash darvozasi.
 *
 * Bazasiz: repozitoriylar o'rniga xotiradagi qatorlar. Tekshiruv holatini
 * hisoblash HAQIQIY `DriverVerificationService` bilan bajariladi — mock
 * qilinsa, aynan ikki tizim tutashgan joy (qoidalar → yoqish huquqi)
 * sinovdan tashqarida qolardi.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-08-19T09:00:00.000Z');

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * MS_PER_DAY);
}

// TypeORM `where` shartining kerakli qismi: tenglik va `In(...)`.
function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected instanceof FindOperator) {
      return (expected.value as unknown[]).includes(row[key]);
    }
    return row[key] === expected;
  });
}

function fakeRepository<T extends Record<string, unknown>>(rows: T[]) {
  return {
    rows,
    find: jest.fn(async (options: { where?: Record<string, unknown>; take?: number } = {}) => {
      const matched = rows.filter((row) => matchesWhere(row, options.where ?? {}));
      return options.take ? matched.slice(0, options.take) : matched;
    }),
    findOne: jest.fn(
      async (options: { where: Record<string, unknown> }) =>
        rows.find((row) => matchesWhere(row, options.where)) ?? null,
    ),
    save: jest.fn(async (entity: Record<string, unknown>) => {
      const index = rows.findIndex((row) => row['id'] === entity['id']);
      const saved = { ...(index >= 0 ? rows[index] : {}), ...entity } as T;
      if (index >= 0) rows[index] = saved;
      else rows.push(saved);
      return saved;
    }),
  };
}

interface RequirementRow extends Record<string, unknown> {
  code: string;
  label: string;
  hint: string | null;
  kind: DriverVerificationKind;
  serviceType: ServiceType | null;
  vehicleType: VehicleType | null;
  cadenceDays: number;
  graceDays: number;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
}

function requirement(overrides: Partial<RequirementRow> & { code: string }): RequirementRow {
  return {
    label: overrides.code,
    hint: null,
    kind: DriverVerificationKind.VEHICLE_PHOTO,
    serviceType: null,
    vehicleType: null,
    cadenceDays: 30,
    graceDays: 5,
    isRequired: true,
    isActive: true,
    sortOrder: 10,
    createdAt: daysFromNow(-90),
    ...overrides,
  };
}

interface SubmissionRow extends Record<string, unknown> {
  id: string;
  driverId: string;
  code: string;
  reviewStatus: DriverVerificationReviewStatus;
  rejectionReason: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  validUntil: Date | null;
}

function approved(code: string, validUntil: Date | null = daysFromNow(20)): SubmissionRow {
  return {
    id: `sub-${code}`,
    driverId: 'driver-1',
    code,
    reviewStatus: DriverVerificationReviewStatus.APPROVED,
    rejectionReason: null,
    submittedAt: daysFromNow(-10),
    reviewedAt: daysFromNow(-10),
    validUntil,
  };
}

interface Harness {
  service: DriverServicesService;
  driverRepo: ReturnType<typeof fakeRepository>;
  orderRepo: ReturnType<typeof fakeRepository>;
}

function buildHarness(options: {
  driver?: Record<string, unknown>;
  requirements?: RequirementRow[];
  submissions?: SubmissionRow[];
  orders?: Record<string, unknown>[];
}): Harness {
  const driverRepo = fakeRepository<Record<string, unknown>>([
    {
      id: 'driver-1',
      userId: 'user-1',
      vehicleType: null,
      serviceTypes: [ServiceType.TAXI],
      ...options.driver,
    },
  ]);
  const requirementRepo = fakeRepository<Record<string, unknown>>(options.requirements ?? []);
  const submissionRepo = fakeRepository<Record<string, unknown>>(options.submissions ?? []);
  const orderRepo = fakeRepository<Record<string, unknown>>(options.orders ?? []);

  const verification = new DriverVerificationService(
    requirementRepo as never,
    submissionRepo as never,
    driverRepo as never,
  );
  const service = new DriverServicesService(
    driverRepo as never,
    orderRepo as never,
    verification,
  );
  return { service, driverRepo, orderRepo };
}

describe('DriverServicesService', () => {
  describe('GET /drivers/me/services', () => {
    it("kontrakt shaklini qaytaradi: nom va izoh SERVERDAN", async () => {
      const { service } = buildHarness({});

      const summary = await service.getForUser('user-1', NOW);

      expect(summary.enabled).toEqual([ServiceType.TAXI]);
      expect(summary.options).toHaveLength(4);
      expect(summary.options[0]).toEqual({
        serviceType: ServiceType.TAXI,
        label: 'Taksi',
        description: "Yo'lovchi tashish",
        enabled: true,
        canEnable: true,
        blockedReason: null,
        missingRequirements: [],
      });
      // Ilovada tarjima jadvali yo'q — har bir tur matn bilan kelishi shart.
      for (const option of summary.options) {
        expect(option.label.length).toBeGreaterThan(0);
        expect(option.description.length).toBeGreaterThan(0);
      }
    });

    it("tekshiruvdan o'tmagan tur sabab va yetishmayotgan kod bilan keladi", async () => {
      const { service } = buildHarness({
        requirements: [
          requirement({
            code: 'thermal_bag_photo',
            label: 'Termo-sumka fotosi',
            serviceType: ServiceType.FOOD,
          }),
        ],
      });

      const summary = await service.getForUser('user-1', NOW);
      const food = summary.options.find((o) => o.serviceType === ServiceType.FOOD);

      expect(food).toMatchObject({
        enabled: false,
        canEnable: false,
        blockedReason: 'Termo-sumka fotosi tasdiqlanmagan',
        missingRequirements: ['thermal_bag_photo'],
      });
    });

    it("boshqa turning qoidasi mavjud turga ta'sir qilmaydi", async () => {
      const { service } = buildHarness({
        requirements: [
          requirement({ code: 'thermal_bag_photo', serviceType: ServiceType.FOOD }),
        ],
      });

      const summary = await service.getForUser('user-1', NOW);

      expect(summary.options.find((o) => o.serviceType === ServiceType.TAXI)).toMatchObject({
        canEnable: true,
        blockedReason: null,
      });
    });

    it("hammaga tegishli (service_type IS NULL) qoida hech bir turni bloklamaydi", async () => {
      // ⚠️ Bu darvoza ONLAYN darvozasi emas: pasporti yo'q haydovchi
      // ishlay olmaydi, lekin bu "xizmat turini tanlay olmaydi" degani emas.
      // Aks holda haydovchi hech qachon o'zgartira olmaydigan ekran ko'rardi.
      const { service } = buildHarness({
        requirements: [requirement({ code: 'passport', serviceType: null, cadenceDays: 0 })],
      });

      const summary = await service.getForUser('user-1', NOW);

      expect(summary.options.every((o) => o.canEnable)).toBe(true);
    });
  });

  describe('PATCH — yoqish tekshiruvga bog\'liq', () => {
    it("tekshiruvdan o'tmagan turni yoqib bo'lmaydi", async () => {
      const { service, driverRepo } = buildHarness({
        requirements: [
          requirement({
            code: 'thermal_bag_photo',
            label: 'Termo-sumka fotosi',
            serviceType: ServiceType.FOOD,
          }),
        ],
      });

      await expect(
        service.updateForUser('user-1', [ServiceType.TAXI, ServiceType.FOOD], NOW),
      ).rejects.toThrow(BadRequestException);

      // Sabab QAYSI TUR va NIMA yetishmayotganini aytishi shart.
      await expect(
        service.updateForUser('user-1', [ServiceType.TAXI, ServiceType.FOOD], NOW),
      ).rejects.toThrow(/Ovqat yetkazish.*Termo-sumka fotosi/s);

      // Hech narsa saqlanmagan bo'lishi kerak.
      expect(driverRepo.save).not.toHaveBeenCalled();
    });

    it("ko'rilmagan (pending_review) material YETARLI EMAS", async () => {
      // Aks holda istalgan odam bo'sh rasm yuklab, o'sha zahoti ovqat
      // yetkazishni yoqib olardi.
      const { service } = buildHarness({
        requirements: [
          requirement({ code: 'thermal_bag_photo', serviceType: ServiceType.FOOD }),
        ],
        submissions: [
          {
            ...approved('thermal_bag_photo'),
            reviewStatus: DriverVerificationReviewStatus.PENDING,
            reviewedAt: null,
            validUntil: null,
          },
        ],
      });

      await expect(
        service.updateForUser('user-1', [ServiceType.FOOD], NOW),
      ).rejects.toThrow(BadRequestException);
    });

    it('tasdiqlangan material bilan yoqiladi', async () => {
      const { service } = buildHarness({
        requirements: [
          requirement({ code: 'thermal_bag_photo', serviceType: ServiceType.FOOD }),
        ],
        submissions: [approved('thermal_bag_photo')],
      });

      const summary = await service.updateForUser('user-1', [ServiceType.TAXI, ServiceType.FOOD], NOW);

      expect(summary.enabled).toEqual([ServiceType.TAXI, ServiceType.FOOD]);
    });

    it("HIMOYA: tur uchun birorta qoida sozlanmagan bo'lsa yoqishga ruxsat", async () => {
      // "Qoida yo'q" = "cheklov yo'q". Teskarisi bo'lsa, foydalanuvchi
      // haqiqiy ro'yxatni bermaguncha hech kim hech narsani yoqa olmasdi.
      const { service } = buildHarness({ requirements: [] });

      const summary = await service.updateForUser(
        'user-1',
        [ServiceType.FOOD, ServiceType.MARKET],
        NOW,
      );

      expect(summary.enabled).toEqual([ServiceType.FOOD, ServiceType.MARKET]);
    });

    it("faqat MAJBURIY qoida bloklaydi (isRequired = false — tavsiya)", async () => {
      const { service } = buildHarness({
        requirements: [
          requirement({ code: 'food_hygiene_cert', serviceType: ServiceType.FOOD, isRequired: false }),
        ],
      });

      await expect(service.updateForUser('user-1', [ServiceType.FOOD], NOW)).resolves.toMatchObject({
        enabled: [ServiceType.FOOD],
      });
    });

    it("transport turi mos kelmasa qoida qo'llanmaydi", async () => {
      // Furgon fotosi yengil avtomobil haydovchisidan so'ralmaydi —
      // findApplicableRequirements dagi bilan bir xil qoida.
      const { service } = buildHarness({
        driver: { vehicleType: null },
        requirements: [
          requirement({
            code: 'vehicle_photo_cargo_bay',
            serviceType: ServiceType.CARGO,
            vehicleType: VehicleType.VAN,
          }),
        ],
      });

      await expect(service.updateForUser('user-1', [ServiceType.CARGO], NOW)).resolves.toMatchObject(
        { enabled: [ServiceType.CARGO] },
      );
    });
  });

  describe("PATCH — bo'sh ro'yxat", () => {
    it("bo'sh ro'yxat rad etiladi", async () => {
      // Saqlansa haydovchi hech qanday buyurtma kelmaydigan holatga
      // tushib qolardi va sababini hech qayerda ko'rmasdi.
      const { service, driverRepo } = buildHarness({});

      await expect(service.updateForUser('user-1', [], NOW)).rejects.toThrow(
        /Kamida bitta xizmat turi/,
      );
      expect(driverRepo.save).not.toHaveBeenCalled();
    });

    it("faqat kuryer bo'lish MUMKIN — taksi majburiy emas", async () => {
      const { service } = buildHarness({});

      const summary = await service.updateForUser('user-1', [ServiceType.FOOD], NOW);

      expect(summary.enabled).toEqual([ServiceType.FOOD]);
    });
  });

  describe("PATCH — faol buyurtma", () => {
    const activeTaxiOrder = {
      id: 'order-1',
      driverId: 'driver-1',
      serviceType: ServiceType.TAXI,
      status: OrderStatus.IN_PROGRESS,
    };

    it("faol buyurtma turini o'chirib bo'lmaydi", async () => {
      const { service, driverRepo } = buildHarness({
        driver: { serviceTypes: [ServiceType.TAXI, ServiceType.FOOD] },
        orders: [activeTaxiOrder],
      });

      await expect(service.updateForUser('user-1', [ServiceType.FOOD], NOW)).rejects.toThrow(
        /Taksi.*faol buyurtma/s,
      );
      expect(driverRepo.save).not.toHaveBeenCalled();
    });

    it("faol buyurtma boshqa turda bo'lsa o'chirishga xalaqit bermaydi", async () => {
      const { service } = buildHarness({
        driver: { serviceTypes: [ServiceType.TAXI, ServiceType.FOOD] },
        orders: [activeTaxiOrder],
      });

      const summary = await service.updateForUser('user-1', [ServiceType.TAXI], NOW);

      expect(summary.enabled).toEqual([ServiceType.TAXI]);
    });

    it("yakunlangan buyurtma to'sqinlik qilmaydi", async () => {
      const { service } = buildHarness({
        driver: { serviceTypes: [ServiceType.TAXI, ServiceType.FOOD] },
        orders: [{ ...activeTaxiOrder, status: OrderStatus.COMPLETED }],
      });

      await expect(service.updateForUser('user-1', [ServiceType.FOOD], NOW)).resolves.toMatchObject({
        enabled: [ServiceType.FOOD],
      });
    });

    it("turni SAQLAB qolganda faol buyurtma tekshirilmaydi", async () => {
      const { service, orderRepo } = buildHarness({
        driver: { serviceTypes: [ServiceType.TAXI] },
        orders: [activeTaxiOrder],
      });

      await service.updateForUser('user-1', [ServiceType.TAXI, ServiceType.FOOD], NOW);

      expect(orderRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('PATCH dan keyin matching haydovchini topadi', () => {
    it("ovqat buyurtmasi mos kela boshlaydi", async () => {
      // Aynan tuzatilayotgan nuqson: migratsiya hammaga ['taxi'] yozgani
      // uchun food/market buyurtmalari hech kimga mos kelmasdi.
      const { service, driverRepo } = buildHarness({
        requirements: [
          requirement({ code: 'thermal_bag_photo', serviceType: ServiceType.FOOD }),
        ],
        submissions: [approved('thermal_bag_photo')],
      });
      const foodFilter = { serviceType: ServiceType.FOOD, vehicleType: null };

      const before = driverRepo.rows[0] as { serviceTypes: ServiceType[]; vehicleType: null };
      expect(driverMatchesCapabilities(before, foodFilter)).toBe(false);

      await service.updateForUser('user-1', [ServiceType.TAXI, ServiceType.FOOD], NOW);

      const after = driverRepo.rows[0] as { serviceTypes: ServiceType[]; vehicleType: null };
      expect(driverMatchesCapabilities(after, foodFilter)).toBe(true);
      // Taksi ham saqlanib qolgan bo'lishi kerak.
      expect(
        driverMatchesCapabilities(after, { serviceType: ServiceType.TAXI, vehicleType: null }),
      ).toBe(true);
    });

    it("o'chirilgan tur matching'dan chiqib ketadi", async () => {
      const { service, driverRepo } = buildHarness({
        driver: { serviceTypes: [ServiceType.TAXI, ServiceType.MARKET] },
      });

      await service.updateForUser('user-1', [ServiceType.MARKET], NOW);

      const after = driverRepo.rows[0] as { serviceTypes: ServiceType[]; vehicleType: null };
      expect(driverMatchesCapabilities(after, { serviceType: ServiceType.TAXI })).toBe(false);
      expect(driverMatchesCapabilities(after, { serviceType: ServiceType.MARKET })).toBe(true);
    });
  });

  describe("muddati o'tgan tasdiq", () => {
    it("overdue holat yoqishga yo'l bermaydi", async () => {
      const { service } = buildHarness({
        requirements: [
          requirement({ code: 'thermal_bag_photo', serviceType: ServiceType.FOOD }),
        ],
        submissions: [approved('thermal_bag_photo', daysFromNow(-1))],
      });

      await expect(service.updateForUser('user-1', [ServiceType.FOOD], NOW)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("due_soon holat YETARLI — haydovchi hali muddati ichida", async () => {
      const { service } = buildHarness({
        requirements: [
          requirement({ code: 'thermal_bag_photo', serviceType: ServiceType.FOOD }),
        ],
        submissions: [approved('thermal_bag_photo', daysFromNow(1))],
      });

      await expect(service.updateForUser('user-1', [ServiceType.FOOD], NOW)).resolves.toMatchObject({
        enabled: [ServiceType.FOOD],
      });
    });
  });
});
