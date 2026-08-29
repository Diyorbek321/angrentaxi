import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { DriverVerificationService, VerificationDriver } from './driver-verification.service';
import {
  DriverVerificationKind,
  DriverVerificationRequirement,
} from '../../database/entities/driver-verification-requirement.entity';
import {
  DriverVerificationReviewStatus,
  DriverVerificationSubmission,
} from '../../database/entities/driver-verification-submission.entity';
import { ServiceType } from '../../database/entities/order.entity';
import { VehicleType } from '../../database/entities/tariff.entity';
import { UserRole } from '../../database/entities/user.entity';

/**
 * Davriy tekshiruv — holat hisoblash va majburlash.
 *
 * Testlar bazasiz: repozitoriylar o'rniga xotiradagi soddalashtirilgan
 * qatorlar. Sinaladigan narsa SQL emas, aynan QOIDA — qaysi holat qachon
 * chiqadi va kim qachon bloklanadi.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-15T10:00:00.000Z');

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * MS_PER_DAY);
}

// TypeORM `where` shartining kerakli qismini taqlid qiladi: oddiy tenglik
// va `In(...)`. Servis boshqa operator ishlatmaydi.
function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected instanceof FindOperator) {
      return (expected.value as unknown[]).includes(row[key]);
    }
    return row[key] === expected;
  });
}

function sortRows<T extends Record<string, unknown>>(
  rows: T[],
  order?: Record<string, 'ASC' | 'DESC'>,
): T[] {
  if (!order) return rows;
  const entries = Object.entries(order);
  return [...rows].sort((a, b) => {
    for (const [key, direction] of entries) {
      const left = a[key];
      const right = b[key];
      const leftValue = left instanceof Date ? left.getTime() : (left as number | string);
      const rightValue = right instanceof Date ? right.getTime() : (right as number | string);
      if (leftValue === rightValue) continue;
      const cmp = leftValue < rightValue ? -1 : 1;
      return direction === 'DESC' ? -cmp : cmp;
    }
    return 0;
  });
}

function fakeRepository<T extends Record<string, unknown>>(rows: T[]) {
  let sequence = 0;
  return {
    rows,
    find: jest.fn(async (options: { where?: Record<string, unknown>; order?: Record<string, 'ASC' | 'DESC'> } = {}) =>
      sortRows(rows.filter((row) => matchesWhere(row, options.where ?? {})), options.order),
    ),
    findOne: jest.fn(
      async (options: { where: Record<string, unknown> }) =>
        rows.find((row) => matchesWhere(row, options.where)) ?? null,
    ),
    count: jest.fn(
      async (options: { where?: Record<string, unknown> } = {}) =>
        rows.filter((row) => matchesWhere(row, options.where ?? {})).length,
    ),
    save: jest.fn(async (entity: Record<string, unknown>) => {
      const existingIndex = entity['id'] ? rows.findIndex((r) => r['id'] === entity['id']) : -1;
      const saved = { ...(existingIndex >= 0 ? rows[existingIndex] : {}), ...entity } as T;
      if (!saved['id']) {
        (saved as Record<string, unknown>)['id'] = `generated-${++sequence}`;
      }
      if (existingIndex >= 0) {
        rows[existingIndex] = saved;
      } else {
        rows.push(saved);
      }
      return saved;
    }),
  };
}

function requirement(
  overrides: Partial<DriverVerificationRequirement> = {},
): DriverVerificationRequirement {
  return {
    id: `req-${overrides.code ?? 'default'}`,
    code: 'vehicle_photo_front',
    label: 'Avtomobil old tomondan',
    hint: "Davlat raqami ko'rinsin",
    kind: DriverVerificationKind.VEHICLE_PHOTO,
    serviceType: null,
    vehicleType: null,
    cadenceDays: 30,
    graceDays: 0,
    isRequired: true,
    isActive: true,
    sortOrder: 10,
    // Ancha eski qoida — "yangi qoida" himoyasi aralashmasin.
    createdAt: daysFromNow(-365),
    updatedAt: daysFromNow(-365),
    ...overrides,
  };
}

function submission(
  overrides: Partial<DriverVerificationSubmission> = {},
): DriverVerificationSubmission {
  return {
    id: `sub-${Math.random().toString(36).slice(2)}`,
    driverId: 'driver-1',
    code: 'vehicle_photo_front',
    fileUrl: '/uploads/driver-documents/photo.jpg',
    reviewStatus: DriverVerificationReviewStatus.PENDING,
    rejectionReason: null,
    submittedAt: daysFromNow(-1),
    reviewedAt: null,
    reviewedBy: null,
    validUntil: null,
    ...overrides,
  } as DriverVerificationSubmission;
}

const taxiDriver: VerificationDriver = {
  id: 'driver-1',
  vehicleType: null,
  serviceTypes: [ServiceType.TAXI],
};

function buildService(
  requirements: DriverVerificationRequirement[],
  submissions: DriverVerificationSubmission[] = [],
  drivers: Array<Record<string, unknown>> = [{ id: 'driver-1', userId: 'user-1' }],
) {
  const requirementRepository = fakeRepository(requirements as unknown as Array<Record<string, unknown>>);
  const submissionRepository = fakeRepository(submissions as unknown as Array<Record<string, unknown>>);
  // `@CreateDateColumn` ni taqlid qiladi: haqiqiy bazada `submitted_at` ni
  // TypeORM insert paytida o'zi to'ldiradi, xotiradagi soxta repozitoriy esa
  // buni bilmaydi.
  const rawSave = submissionRepository.save;
  submissionRepository.save = jest.fn(async (entity: Record<string, unknown>) =>
    rawSave({ submittedAt: NOW, ...entity }),
  );
  const driverRepository = fakeRepository(drivers);
  const service = new DriverVerificationService(
    requirementRepository as never,
    submissionRepository as never,
    driverRepository as never,
  );
  return { service, requirementRepository, submissionRepository, driverRepository };
}

describe('DriverVerificationService — KONTRAKT shakli', () => {
  // Kontrakt muzokara qilinmaydi: mobil ilova AYNAN shu kalitlarni kutadi.
  // Ortiqcha yoki kam maydon — ikki tomonni jimgina ajratib yuboradigan xato.
  it('javob va element kalitlari kontraktdagidek', async () => {
    const { service } = buildService(
      [requirement()],
      [
        submission({
          reviewStatus: DriverVerificationReviewStatus.APPROVED,
          validUntil: daysFromNow(12),
        }),
      ],
    );

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(Object.keys(summary).sort()).toEqual(['blockedReason', 'canGoOnline', 'items']);
    expect(Object.keys(summary.items[0]).sort()).toEqual([
      'code',
      'daysLeft',
      'hint',
      'isRequired',
      'kind',
      'label',
      'rejectionReason',
      'status',
      'validUntil',
    ]);
    expect(summary.items[0].validUntil).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("code ERKIN SATR — enum ro'yxati yo'q, ixtiyoriy kalit ishlaydi", async () => {
    // Bu himoya qilinayotgan asosiy qaror: yangi talab qo'shish uchun
    // backendda ham, mobil ilovada ham kod o'zgarmasligi kerak.
    const { service } = buildService([
      requirement({ code: 'kelajakdagi_yangi_talab_2027', label: 'Yangi talab' }),
    ]);

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.items[0].code).toBe('kelajakdagi_yangi_talab_2027');
    expect(summary.items[0].label).toBe('Yangi talab');
  });
});

describe('DriverVerificationService — HIMOYA (a): qoidalar sozlanmagan', () => {
  it("jadval BO'SH bo'lsa hech kim bloklanmaydi", async () => {
    // Foydalanuvchi haqiqiy ro'yxatni hali bermagan. "Qoida yo'q" ni
    // "hammasi taqiqlangan" deb o'qish butun parkni oflayn qilib qo'yardi.
    const { service } = buildService([]);

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary).toEqual({ canGoOnline: true, blockedReason: null, items: [] });
  });

  it("bo'sh jadvalda goOnline darvozasi xato tashlamaydi", async () => {
    const { service } = buildService([]);

    await expect(service.assertCanGoOnline(taxiDriver, NOW)).resolves.toBeUndefined();
  });

  it('faqat NOMOS qoidalar bo\'lsa ham bloklanmaydi', async () => {
    // Furgon uchun qoida yengil avtomobil haydovchisiga umuman tegishli emas.
    const { service } = buildService([
      requirement({ code: 'cargo_bay', vehicleType: VehicleType.VAN, graceDays: 0 }),
    ]);

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.items).toEqual([]);
    expect(summary.canGoOnline).toBe(true);
  });
});

describe('DriverVerificationService — qo\'llanish doirasi', () => {
  it('transport turiga bog\'liq qoida faqat o\'sha turdagi haydovchida chiqadi', async () => {
    const { service } = buildService([
      requirement({ code: 'common' }),
      requirement({ code: 'van_only', vehicleType: VehicleType.VAN }),
    ]);

    const vanDriver: VerificationDriver = {
      id: 'driver-1',
      vehicleType: VehicleType.VAN,
      serviceTypes: [ServiceType.CARGO],
    };

    const taxi = await service.getSummaryForDriver(taxiDriver, NOW);
    const van = await service.getSummaryForDriver(vanDriver, NOW);

    expect(taxi.items.map((i) => i.code)).toEqual(['common']);
    expect(van.items.map((i) => i.code)).toEqual(['common', 'van_only']);
  });

  it('xizmat turiga bog\'liq qoida faqat o\'sha xizmatda chiqadi', async () => {
    const { service } = buildService([
      requirement({ code: 'cargo_only', serviceType: ServiceType.CARGO }),
    ]);

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.items).toEqual([]);
  });

  it("bo'sh serviceTypes ['taxi'] deb o'qiladi (migratsiya xavfsizligi)", async () => {
    // `resolveDriverServiceTypes` bilan bir xil qoida: bo'sh ro'yxat "hech
    // nima" emas, "taksi" degani.
    const { service } = buildService([
      requirement({ code: 'taxi_only', serviceType: ServiceType.TAXI }),
    ]);

    const summary = await service.getSummaryForDriver(
      { id: 'driver-1', vehicleType: null, serviceTypes: [] },
      NOW,
    );

    expect(summary.items.map((i) => i.code)).toEqual(['taxi_only']);
  });

  it("is_active = false qoida umuman ko'rinmaydi", async () => {
    const { service } = buildService([requirement({ code: 'retired', isActive: false })]);

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.items).toEqual([]);
  });
});

describe('DriverVerificationService — holat o\'tishlari', () => {
  async function statusOf(subs: DriverVerificationSubmission[], req = requirement()) {
    const { service } = buildService([req], subs);
    const summary = await service.getSummaryForDriver(taxiDriver, NOW);
    return summary.items[0];
  }

  it('hech qachon yuborilmagan → missing', async () => {
    const item = await statusOf([]);

    expect(item.status).toBe('missing');
    expect(item.validUntil).toBeNull();
    expect(item.daysLeft).toBeNull();
  });

  it("yuborilgan, ko'rilmagan → pending_review", async () => {
    const item = await statusOf([submission()]);

    expect(item.status).toBe('pending_review');
  });

  it('rad etilgan → rejected, sababi bilan', async () => {
    const item = await statusOf([
      submission({
        reviewStatus: DriverVerificationReviewStatus.REJECTED,
        rejectionReason: 'Rasm xira',
        reviewedAt: daysFromNow(-1),
      }),
    ]);

    expect(item.status).toBe('rejected');
    expect(item.rejectionReason).toBe('Rasm xira');
  });

  it('tasdiqlangan va muddatsiz → ok', async () => {
    const item = await statusOf(
      [
        submission({
          reviewStatus: DriverVerificationReviewStatus.APPROVED,
          reviewedAt: daysFromNow(-100),
          validUntil: null,
        }),
      ],
      requirement({ cadenceDays: 0 }),
    );

    expect(item.status).toBe('ok');
    expect(item.validUntil).toBeNull();
  });

  it('tasdiqlangan, muddat uzoq → ok va daysLeft musbat', async () => {
    const item = await statusOf([
      submission({
        reviewStatus: DriverVerificationReviewStatus.APPROVED,
        reviewedAt: daysFromNow(-18),
        validUntil: daysFromNow(12),
      }),
    ]);

    expect(item.status).toBe('ok');
    expect(item.daysLeft).toBe(12);
    expect(item.validUntil).toBe(daysFromNow(12).toISOString());
  });

  it('muddatiga 3 kundan kam qoldi → due_soon', async () => {
    const item = await statusOf([
      submission({
        reviewStatus: DriverVerificationReviewStatus.APPROVED,
        validUntil: daysFromNow(2),
      }),
    ]);

    expect(item.status).toBe('due_soon');
    expect(item.daysLeft).toBe(2);
  });

  it('roppa-rosa 3 kun qolganda hali ok (chegara ichkarida emas)', async () => {
    const item = await statusOf([
      submission({
        reviewStatus: DriverVerificationReviewStatus.APPROVED,
        validUntil: daysFromNow(3),
      }),
    ]);

    expect(item.status).toBe('ok');
  });

  it("muddat o'tib ketgan → overdue va daysLeft MANFIY", async () => {
    const item = await statusOf([
      submission({
        reviewStatus: DriverVerificationReviewStatus.APPROVED,
        validUntil: daysFromNow(-4),
      }),
    ]);

    expect(item.status).toBe('overdue');
    expect(item.daysLeft).toBe(-4);
  });

  it('yarim kun kechikkanda daysLeft 0 emas, -1 (kechikkanlik yo\'qolmasin)', async () => {
    const item = await statusOf([
      submission({
        reviewStatus: DriverVerificationReviewStatus.APPROVED,
        validUntil: new Date(NOW.getTime() - MS_PER_DAY / 2),
      }),
    ]);

    expect(item.daysLeft).toBe(-1);
  });

  it('ENG OXIRGI yuborilgan material hisobga olinadi', async () => {
    const item = await statusOf([
      submission({
        submittedAt: daysFromNow(-30),
        reviewStatus: DriverVerificationReviewStatus.APPROVED,
        validUntil: daysFromNow(-5),
      }),
      submission({ submittedAt: daysFromNow(-1) }),
    ]);

    expect(item.status).toBe('pending_review');
  });

  it("label va hint SERVERDAN keladi (mobilda tarjima jadvali yo'q)", async () => {
    const item = await statusOf([]);

    expect(item.label).toBe('Avtomobil old tomondan');
    expect(item.hint).toBe("Davlat raqami ko'rinsin");
    expect(item.kind).toBe(DriverVerificationKind.VEHICLE_PHOTO);
  });
});

describe('DriverVerificationService — HIMOYA (b): yangi qoida parkni oflayn qilmaydi', () => {
  it("bugun qo'shilgan qoida graceDays davomida HECH KIMNI bloklamaydi", async () => {
    // Aynan himoya qilinayotgan nuqson: qoida yozilgan soniyada butun park
    // "missing" bo'lib qoladi. Hisob qoida yaratilgan sanadan boshlanadi.
    const { service } = buildService([
      requirement({ code: 'new_rule', graceDays: 7, createdAt: daysFromNow(-1) }),
    ]);

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.items[0].status).toBe('missing');
    expect(summary.canGoOnline).toBe(true);
    expect(summary.blockedReason).toBeNull();
  });

  it('graceDays tugagach o\'sha qoida bloklaydi', async () => {
    const { service } = buildService([
      requirement({ code: 'new_rule', graceDays: 7, createdAt: daysFromNow(-8) }),
    ]);

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.canGoOnline).toBe(false);
    expect(summary.blockedReason).toContain('Avtomobil old tomondan');
  });

  it("haydovchi ro'yxatdan o'tgan sanasi hisobga OLINMAYDI — KYC teshigi ochilmasin", async () => {
    // Qoida eski, haydovchi yangi: baribir bloklanadi. Aks holda yangi
    // haydovchi graceDays davomida hujjatsiz ishlay olardi.
    const { service } = buildService([
      requirement({ code: 'kyc', graceDays: 7, createdAt: daysFromNow(-400) }),
    ]);

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.canGoOnline).toBe(false);
  });
});

describe('DriverVerificationService — goOnline majburlash', () => {
  it("majburiy element overdue va graceDays ham o'tgan bo'lsa bloklaydi", async () => {
    const { service } = buildService(
      [requirement({ graceDays: 3 })],
      [
        submission({
          reviewStatus: DriverVerificationReviewStatus.APPROVED,
          validUntil: daysFromNow(-5),
        }),
      ],
    );

    await expect(service.assertCanGoOnline(taxiDriver, NOW)).rejects.toThrow(BadRequestException);
  });

  it("overdue bo'lsa ham graceDays hali tugamagan bo'lsa BLOKLAMAYDI", async () => {
    const { service } = buildService(
      [requirement({ graceDays: 3 })],
      [
        submission({
          reviewStatus: DriverVerificationReviewStatus.APPROVED,
          validUntil: daysFromNow(-1),
        }),
      ],
    );

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.items[0].status).toBe('overdue');
    expect(summary.canGoOnline).toBe(true);
    await expect(service.assertCanGoOnline(taxiDriver, NOW)).resolves.toBeUndefined();
  });

  it('ixtiyoriy (isRequired: false) element hech qachon bloklamaydi', async () => {
    const { service } = buildService(
      [requirement({ isRequired: false, graceDays: 0 })],
      [
        submission({
          reviewStatus: DriverVerificationReviewStatus.APPROVED,
          validUntil: daysFromNow(-90),
        }),
      ],
    );

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.items[0].status).toBe('overdue');
    expect(summary.canGoOnline).toBe(true);
  });

  it("pending_review BLOKLAMAYDI — kechikish biz tomonda", async () => {
    const { service } = buildService(
      [requirement({ graceDays: 0 })],
      [submission({ submittedAt: daysFromNow(-10) })],
    );

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.items[0].status).toBe('pending_review');
    expect(summary.canGoOnline).toBe(true);
  });

  it('due_soon BLOKLAMAYDI — bu shunchaki ogohlantirish', async () => {
    const { service } = buildService(
      [requirement({ graceDays: 0 })],
      [
        submission({
          reviewStatus: DriverVerificationReviewStatus.APPROVED,
          validUntil: daysFromNow(1),
        }),
      ],
    );

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.items[0].status).toBe('due_soon');
    expect(summary.canGoOnline).toBe(true);
  });

  it('rad etilgan material graceDays dan keyin bloklaydi', async () => {
    const { service } = buildService(
      [requirement({ graceDays: 2, createdAt: daysFromNow(-400) })],
      [
        submission({
          reviewStatus: DriverVerificationReviewStatus.REJECTED,
          rejectionReason: 'Rasm xira',
          reviewedAt: daysFromNow(-5),
        }),
      ],
    );

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.canGoOnline).toBe(false);
  });

  it('MUDDATSIZ tasdiq bor bo\'lsa, keyingi rad etilgan urinish bloklamaydi', async () => {
    // Haydovchida tasdiqlangan doimiy hujjat bor. Keyin u yaxshiroq nusxa
    // yuborib rad javob olgan — bu allaqachon berilgan tasdiqni bekor
    // qilmaydi, ya'ni uni ishdan to'xtatish uchun asos yo'q.
    const { service } = buildService(
      [requirement({ cadenceDays: 0, graceDays: 0, createdAt: daysFromNow(-400) })],
      [
        submission({
          submittedAt: daysFromNow(-100),
          reviewStatus: DriverVerificationReviewStatus.APPROVED,
          reviewedAt: daysFromNow(-100),
          validUntil: null,
        }),
        submission({
          submittedAt: daysFromNow(-2),
          reviewStatus: DriverVerificationReviewStatus.REJECTED,
          rejectionReason: 'Rasm xira',
          reviewedAt: daysFromNow(-2),
        }),
      ],
    );

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.items[0].status).toBe('rejected');
    expect(summary.canGoOnline).toBe(true);
  });

  it('bloklash sababi o\'zbekcha va qaysi element ekanini aytadi', async () => {
    const { service } = buildService([
      requirement({ code: 'a', label: 'Pasport', graceDays: 0, createdAt: daysFromNow(-10) }),
      requirement({
        code: 'b',
        label: 'Texnik pasport',
        graceDays: 0,
        createdAt: daysFromNow(-10),
        sortOrder: 20,
      }),
    ]);

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);

    expect(summary.blockedReason).toContain('«Pasport»');
    expect(summary.blockedReason).toContain('«Texnik pasport»');
    expect(summary.blockedReason).toContain('Onlayn chiqa olmaysiz');
  });
});

describe('DriverVerificationService.submit', () => {
  it("noma'lum kod rad etiladi", async () => {
    const { service } = buildService([requirement()]);

    await expect(
      service.submit('user-1', 'not_a_real_code', {
        filename: 'x.jpg',
        path: '/tmp/x.jpg',
        mimetype: 'image/jpeg',
        size: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('yuborilgan element pending_review holatida qaytadi', async () => {
    const { service, submissionRepository } = buildService([requirement()]);

    const item = await service.submit(
      'user-1',
      'vehicle_photo_front',
      { filename: 'abc.jpg', path: '/tmp/abc.jpg', mimetype: 'image/jpeg', size: 10 },
      NOW,
    );

    expect(item.status).toBe('pending_review');
    expect(item.code).toBe('vehicle_photo_front');
    expect(item.label).toBe('Avtomobil old tomondan');
    expect(submissionRepository.rows).toHaveLength(1);
    expect(submissionRepository.rows[0]).toMatchObject({
      driverId: 'driver-1',
      // Ochiq URL emas — saqlash manzili.
      fileUrl: '/uploads/driver-documents/abc.jpg',
      reviewStatus: DriverVerificationReviewStatus.PENDING,
      validUntil: null,
    });
  });

  it('har yuborish YANGI qator — eskisi ustiga yozilmaydi', async () => {
    const { service, submissionRepository } = buildService(
      [requirement()],
      [submission({ submittedAt: daysFromNow(-40) })],
    );

    await service.submit(
      'user-1',
      'vehicle_photo_front',
      { filename: 'new.jpg', path: '/tmp/new.jpg', mimetype: 'image/jpeg', size: 10 },
      NOW,
    );

    expect(submissionRepository.rows).toHaveLength(2);
  });

  it("haydovchi profili yo'q bo'lsa 404", async () => {
    const { service } = buildService([requirement()], [], []);

    await expect(
      service.submit('user-nobody', 'vehicle_photo_front', {
        filename: 'x.jpg',
        path: '/tmp/x.jpg',
        mimetype: 'image/jpeg',
        size: 10,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('DriverVerificationService.review', () => {
  it('tasdiqlashda validUntil = now + cadenceDays', async () => {
    const pending = submission({ id: 'sub-1' });
    const { service, submissionRepository } = buildService(
      [requirement({ cadenceDays: 30 })],
      [pending],
    );

    const item = await service.review('sub-1', 'manager-1', { approved: true }, NOW);

    expect(item.status).toBe('ok');
    expect(item.validUntil).toBe(daysFromNow(30).toISOString());
    expect(item.daysLeft).toBe(30);
    expect(submissionRepository.rows[0]).toMatchObject({
      reviewStatus: DriverVerificationReviewStatus.APPROVED,
      reviewedBy: 'manager-1',
      reviewedAt: NOW,
    });
  });

  it('cadenceDays = 0 bo\'lsa validUntil null (muddatsiz)', async () => {
    const { service } = buildService([requirement({ cadenceDays: 0 })], [submission({ id: 'sub-1' })]);

    const item = await service.review('sub-1', 'manager-1', { approved: true }, NOW);

    expect(item.validUntil).toBeNull();
    expect(item.status).toBe('ok');
  });

  it('rad etishda sabab MAJBURIY', async () => {
    const { service } = buildService([requirement()], [submission({ id: 'sub-1' })]);

    await expect(
      service.review('sub-1', 'manager-1', { approved: false }, NOW),
    ).rejects.toThrow(BadRequestException);
  });

  it("bo'sh joylardan iborat sabab ham qabul qilinmaydi", async () => {
    const { service } = buildService([requirement()], [submission({ id: 'sub-1' })]);

    await expect(
      service.review('sub-1', 'manager-1', { approved: false, rejectionReason: '   ' }, NOW),
    ).rejects.toThrow(BadRequestException);
  });

  it('rad etilgan material sababi bilan saqlanadi', async () => {
    const { service, submissionRepository } = buildService(
      [requirement()],
      [submission({ id: 'sub-1' })],
    );

    const item = await service.review(
      'sub-1',
      'manager-1',
      { approved: false, rejectionReason: '  Rasm xira  ' },
      NOW,
    );

    expect(item.status).toBe('rejected');
    expect(item.rejectionReason).toBe('Rasm xira');
    expect(submissionRepository.rows[0]).toMatchObject({
      reviewStatus: DriverVerificationReviewStatus.REJECTED,
      validUntil: null,
    });
  });

  it("ikki marta ko'rib chiqishga yo'l qo'yilmaydi", async () => {
    const { service } = buildService(
      [requirement()],
      [
        submission({
          id: 'sub-1',
          reviewStatus: DriverVerificationReviewStatus.APPROVED,
          reviewedAt: daysFromNow(-1),
        }),
      ],
    );

    await expect(service.review('sub-1', 'manager-1', { approved: true }, NOW)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("mavjud bo'lmagan material uchun 404", async () => {
    const { service } = buildService([requirement()], []);

    await expect(service.review('yo-q', 'manager-1', { approved: true }, NOW)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("tasdiqlangandan keyin haydovchi darhol onlayn chiqa oladi", async () => {
    // To'liq oqim: bloklangan haydovchi → yuboradi → tasdiqlanadi → ochiladi.
    const { service } = buildService([
      requirement({ cadenceDays: 30, graceDays: 0, createdAt: daysFromNow(-400) }),
    ]);

    await expect(service.assertCanGoOnline(taxiDriver, NOW)).rejects.toThrow(BadRequestException);

    const submitted = await service.submit(
      'user-1',
      'vehicle_photo_front',
      { filename: 'a.jpg', path: '/tmp/a.jpg', mimetype: 'image/jpeg', size: 1 },
      NOW,
    );
    expect(submitted.status).toBe('pending_review');

    const pending = await service.listPending();
    await service.review(pending[0].id, 'manager-1', { approved: true }, NOW);

    const summary = await service.getSummaryForDriver(taxiDriver, NOW);
    expect(summary.items[0].status).toBe('ok');
    expect(summary.canGoOnline).toBe(true);
  });
});

describe('DriverVerificationService.listPending', () => {
  it("faqat ko'rilmaganlarni, eng eskisidan boshlab qaytaradi", async () => {
    const { service } = buildService(
      [requirement({ code: 'vehicle_photo_front', label: 'Avtomobil old tomondan' })],
      [
        submission({ id: 'new', submittedAt: daysFromNow(-1) }),
        submission({ id: 'old', submittedAt: daysFromNow(-5) }),
        submission({
          id: 'done',
          submittedAt: daysFromNow(-9),
          reviewStatus: DriverVerificationReviewStatus.APPROVED,
        }),
      ],
      [
        {
          id: 'driver-1',
          userId: 'user-1',
          user: { firstName: 'Sardor', lastName: 'Toshmatov', phone: '+998901234571' },
        },
      ],
    );

    const pending = await service.listPending();

    expect(pending.map((p) => p.id)).toEqual(['old', 'new']);
    expect(pending[0]).toMatchObject({
      label: 'Avtomobil old tomondan',
      driverName: 'Sardor Toshmatov',
      driverPhone: '+998901234571',
    });
  });

  it("qoida o'chirilgan bo'lsa ham navbat ochiq qoladi (label o'rniga code)", async () => {
    const { service } = buildService([], [submission({ id: 'orphan' })]);

    const pending = await service.listPending();

    expect(pending).toHaveLength(1);
    expect(pending[0].label).toBe('vehicle_photo_front');
  });
});

describe('DriverVerificationService.getFileForDownload', () => {
  it("haydovchi BEGONA materialni ololmaydi", async () => {
    const { service } = buildService(
      [requirement()],
      [submission({ id: 'sub-1', driverId: 'driver-2' })],
      [{ id: 'driver-1', userId: 'user-1' }],
    );

    await expect(
      service.getFileForDownload('sub-1', { id: 'user-1', role: UserRole.DRIVER }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('yo\'lovchi umuman ruxsat olmaydi', async () => {
    const { service } = buildService([requirement()], [submission({ id: 'sub-1' })]);

    await expect(
      service.getFileForDownload('sub-1', { id: 'user-9', role: UserRole.PASSENGER }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("mavjud bo'lmagan material uchun 404 (fayl tizimiga tegilmaydi)", async () => {
    const { service } = buildService([requirement()], []);

    await expect(
      service.getFileForDownload('yo-q', { id: 'staff-1', role: UserRole.ADMIN }),
    ).rejects.toThrow(NotFoundException);
  });
});
