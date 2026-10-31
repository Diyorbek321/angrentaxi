import { DriverVerificationRemindersService } from './driver-verification-reminders.service';
import {
  DriverVerificationItem,
  DriverVerificationSummary,
} from './driver-verification.service';
import { DriverVerificationKind } from '../../database/entities/driver-verification-requirement.entity';

/**
 * Kunlik eslatma cron'i.
 *
 * Bu yerda tekshiriladigan asosiy narsa — MUSTAHKAMLIK: bitta haydovchidagi
 * yoki bitta kanaldagi xato butun yuborishni to'xtatmasligi kerak. Bonus
 * xabarlaridagi (`driver-bonuses.service.ts`) bilan bir xil talab.
 */

const NOW = new Date('2026-06-15T09:00:00.000Z');

function item(overrides: Partial<DriverVerificationItem> = {}): DriverVerificationItem {
  return {
    code: 'vehicle_photo_front',
    label: 'Avtomobil old tomondan',
    hint: null,
    kind: DriverVerificationKind.VEHICLE_PHOTO,
    status: 'due_soon',
    validUntil: null,
    daysLeft: 2,
    rejectionReason: null,
    isRequired: true,
    ...overrides,
  };
}

function summary(items: DriverVerificationItem[]): DriverVerificationSummary {
  return { canGoOnline: true, blockedReason: null, items };
}

interface Harness {
  service: DriverVerificationRemindersService;
  emitToUser: jest.Mock;
  notifyVerificationDue: jest.Mock;
  driverFind: jest.Mock;
  requirementCount: jest.Mock;
  getSummaryForDriver: jest.Mock;
}

function buildHarness(options: {
  drivers?: Array<Record<string, unknown>>;
  activeRequirements?: number;
  summaries?: Record<string, DriverVerificationSummary | Error>;
}): Harness {
  const drivers = options.drivers ?? [
    { id: 'driver-1', userId: 'user-1', user: { id: 'user-1', fcmToken: 'token-1' } },
  ];

  const driverFind = jest.fn(async () => drivers);
  const requirementCount = jest.fn(async () => options.activeRequirements ?? 1);
  const getSummaryForDriver = jest.fn(async (driver: { id: string }) => {
    const result = options.summaries?.[driver.id] ?? summary([]);
    if (result instanceof Error) throw result;
    return result;
  });
  const emitToUser = jest.fn();
  const notifyVerificationDue = jest.fn(async () => undefined);

  const service = new DriverVerificationRemindersService(
    { find: driverFind } as never,
    { count: requirementCount } as never,
    { getSummaryForDriver } as never,
    { emitToUser } as never,
    { notifyVerificationDue } as never,
  );

  return { service, emitToUser, notifyVerificationDue, driverFind, requirementCount, getSummaryForDriver };
}

describe('DriverVerificationRemindersService', () => {
  beforeEach(() => {
    // Xato yo'llari log yozadi — test chiqishini toza saqlaymiz.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("qoida sozlanmagan bo'lsa haydovchilar jadvaliga UMUMAN tegmaydi", async () => {
    // HIMOYA (a) ning cron tomondagi ko'rinishi: bo'sh jadval = ish yo'q.
    const h = buildHarness({ activeRequirements: 0 });

    const result = await h.service.sendReminders(NOW);

    expect(result).toEqual({ notifiedDrivers: 0, failedDrivers: 0 });
    expect(h.driverFind).not.toHaveBeenCalled();
  });

  it('due_soon haydovchiga socket ham, push ham yuboradi', async () => {
    const h = buildHarness({
      summaries: { 'driver-1': summary([item({ status: 'due_soon', daysLeft: 2 })]) },
    });

    const result = await h.service.sendReminders(NOW);

    expect(result.notifiedDrivers).toBe(1);
    expect(h.emitToUser).toHaveBeenCalledWith('user-1', 'verification:due', {
      hasOverdue: false,
      items: [
        {
          code: 'vehicle_photo_front',
          label: 'Avtomobil old tomondan',
          status: 'due_soon',
          daysLeft: 2,
        },
      ],
    });
    expect(h.notifyVerificationDue).toHaveBeenCalledWith(
      { id: 'user-1', fcmToken: 'token-1' },
      ['Avtomobil old tomondan'],
      false,
    );
  });

  it("overdue bo'lsa xabar boshqacha belgilanadi", async () => {
    const h = buildHarness({
      summaries: { 'driver-1': summary([item({ status: 'overdue', daysLeft: -4 })]) },
    });

    await h.service.sendReminders(NOW);

    expect(h.notifyVerificationDue).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
  });

  it('hammasi joyida bo\'lgan haydovchi bezovta qilinmaydi', async () => {
    const h = buildHarness({
      summaries: { 'driver-1': summary([item({ status: 'ok', daysLeft: 20 })]) },
    });

    const result = await h.service.sendReminders(NOW);

    expect(result.notifiedDrivers).toBe(0);
    expect(h.emitToUser).not.toHaveBeenCalled();
    expect(h.notifyVerificationDue).not.toHaveBeenCalled();
  });

  it("missing holat uchun eslatma yuborilmaydi (onboarding oqimi buni ko'rsatadi)", async () => {
    const h = buildHarness({
      summaries: { 'driver-1': summary([item({ status: 'missing', daysLeft: null })]) },
    });

    const result = await h.service.sendReminders(NOW);

    expect(result.notifiedDrivers).toBe(0);
  });

  it('ixtiyoriy element uchun eslatma yuborilmaydi', async () => {
    const h = buildHarness({
      summaries: {
        'driver-1': summary([item({ status: 'overdue', isRequired: false, daysLeft: -1 })]),
      },
    });

    const result = await h.service.sendReminders(NOW);

    expect(result.notifiedDrivers).toBe(0);
  });

  it("socket xatosi push'ni to'xtatmaydi", async () => {
    // Aynan shuning uchun ikkita alohida try/catch: push — ilovasi yopiq
    // haydovchiga yetib boradigan yagona kanal.
    const h = buildHarness({
      summaries: { 'driver-1': summary([item()]) },
    });
    h.emitToUser.mockImplementation(() => {
      throw new Error('socket down');
    });

    const result = await h.service.sendReminders(NOW);

    expect(result.notifiedDrivers).toBe(1);
    expect(h.notifyVerificationDue).toHaveBeenCalled();
  });

  it("push xatosi cron'ni yiqitmaydi", async () => {
    const h = buildHarness({ summaries: { 'driver-1': summary([item()]) } });
    h.notifyVerificationDue.mockRejectedValue(new Error('fcm down'));

    await expect(h.service.sendReminders(NOW)).resolves.toEqual({
      notifiedDrivers: 1,
      failedDrivers: 0,
    });
  });

  it("bitta haydovchidagi xato QOLGANLARINI to'xtatmaydi", async () => {
    const h = buildHarness({
      drivers: [
        { id: 'driver-bad', userId: 'user-bad', user: { id: 'user-bad', fcmToken: null } },
        { id: 'driver-ok', userId: 'user-ok', user: { id: 'user-ok', fcmToken: 'token' } },
      ],
      summaries: {
        'driver-bad': new Error('db hiccup'),
        'driver-ok': summary([item({ status: 'overdue', daysLeft: -2 })]),
      },
    });

    const result = await h.service.sendReminders(NOW);

    expect(result).toEqual({ notifiedDrivers: 1, failedDrivers: 1 });
    expect(h.emitToUser).toHaveBeenCalledWith('user-ok', 'verification:due', expect.anything());
  });

  it("cron tick ushlanmagan xatoni yutadi — scheduler jim qolmasin", async () => {
    const h = buildHarness({ summaries: { 'driver-1': summary([item()]) } });
    h.requirementCount.mockRejectedValue(new Error('db down'));

    await expect(h.service.handleDailyReminderTick()).resolves.toBeUndefined();
  });

  it("user bog'lanishi yo'q haydovchida push o'tkazib yuboriladi, socket qoladi", async () => {
    const h = buildHarness({
      drivers: [{ id: 'driver-1', userId: 'user-1', user: null }],
      summaries: { 'driver-1': summary([item()]) },
    });

    const result = await h.service.sendReminders(NOW);

    expect(result.notifiedDrivers).toBe(1);
    expect(h.emitToUser).toHaveBeenCalled();
    expect(h.notifyVerificationDue).not.toHaveBeenCalled();
  });
});
