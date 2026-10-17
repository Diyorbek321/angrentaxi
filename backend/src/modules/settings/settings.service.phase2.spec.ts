import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';

/** Bosqich 2: sotuvchi hisob-kitob rejimi va smena sozlamalari. */
describe('SettingsService — sotuvchi hisob-kitobi va smena', () => {
  const DEFAULT_FROM = new Date('2026-12-12T00:00:00+05:00');

  function build(overrides: Record<string, unknown> = {}) {
    const row = {
      id: 's1',
      platformName: 'Angren Taxi',
      supportPhone: '+998',
      supportEmail: 'a@b.uz',
      maintenanceMode: false,
      deliveryFee: 7000,
      maxCashVendorOrder: 200000,
      vendorSettlementMode: 'cash',
      vendorWalletSettlementFrom: DEFAULT_FROM,
      shiftPassEnabled: false,
      shiftPassPrice: 25000,
      shiftPassDurationHours: 24,
      shiftPassServiceTypes: ['taxi'],
      ...overrides,
    };
    const repo = {
      find: jest.fn(async () => [row]),
      update: jest.fn(async (_id: string, changes: Record<string, unknown>) => {
        Object.assign(row, changes);
        return { affected: 1 };
      }),
    };
    return { service: new SettingsService(repo as never), repo };
  }

  afterEach(() => jest.useRealTimers());

  describe('vendor settlement', () => {
    it('standart: cash, 2026-12-12 dan hamyon; bugun amalda — cash', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:00:00Z'));
      const { service } = build();
      await expect(service.getVendorSettlementSettings()).resolves.toEqual({
        vendorSettlementMode: 'cash',
        vendorWalletSettlementFrom: '2026-12-11T19:00:00.000Z',
        effectiveVendorSettlementMode: 'cash',
      });
    });

    it('sana kelgach amaldagi rejim — wallet', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-12-12T08:00:00+05:00'));
      const { service } = build();
      await expect(service.getEffectiveVendorSettlementMode()).resolves.toBe('wallet');
    });

    it('admin wallet ni yoqadi va sanani o‘zgartiradi/null qiladi', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:00:00Z'));
      const { service, repo } = build();
      const res = await service.updateVendorSettlementSettings({
        vendorSettlementMode: 'wallet',
        vendorWalletSettlementFrom: null,
      });
      expect(repo.update).toHaveBeenCalledWith('s1', {
        vendorSettlementMode: 'wallet',
        vendorWalletSettlementFrom: null,
      });
      expect(res).toEqual({
        vendorSettlementMode: 'wallet',
        vendorWalletSettlementFrom: null,
        effectiveVendorSettlementMode: 'wallet',
      });
    });

    it('noto‘g‘ri sana — 400', async () => {
      const { service } = build();
      await expect(
        service.updateVendorSettlementSettings({ vendorWalletSettlementFrom: 'kecha' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('shift pass', () => {
    it('standart qiymatlar', async () => {
      const { service } = build();
      await expect(service.getShiftPassSettings()).resolves.toEqual({
        shiftPassEnabled: false,
        shiftPassPrice: 25000,
        shiftPassDurationHours: 24,
        shiftPassServiceTypes: ['taxi'],
      });
    });

    it('faqat yuborilgan maydonlar o‘zgaradi; xizmat turlari takrorsiz', async () => {
      const { service, repo } = build();
      const res = await service.updateShiftPassSettings({
        shiftPassEnabled: true,
        shiftPassServiceTypes: ['taxi', 'cargo', 'taxi'],
      });
      expect(repo.update).toHaveBeenCalledWith('s1', {
        shiftPassEnabled: true,
        shiftPassServiceTypes: ['taxi', 'cargo'],
      });
      expect(res).toMatchObject({ shiftPassEnabled: true, shiftPassPrice: 25000, shiftPassServiceTypes: ['taxi', 'cargo'] });
    });
  });

  describe('public settings', () => {
    it('kuryer/sotuvchi ilovasi uchun amaldagi rejim qo‘shiladi', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:00:00Z'));
      const { service } = build();
      await expect(service.getPublicSettings()).resolves.toEqual({
        platformName: 'Angren Taxi',
        supportPhone: '+998',
        deliveryFee: 7000,
        maxCashVendorOrder: 200000,
        // UX v5 §7: bepul yetkazish standart o'chiq, vaqt 30–50 daq.
        freeDeliveryFrom: 0,
        deliveryEtaMinMinutes: 30,
        deliveryEtaMaxMinutes: 50,
        vendorSettlementMode: 'cash',
        vendorWalletSettlementFrom: '2026-12-11T19:00:00.000Z',
        // 3-bosqich (§11): hamyonni to'ldirish — standart o'chiq.
        walletTopupEnabled: false,
        walletTopupMin: 10000,
        walletTopupMax: 2000000,
        walletTopupPresets: [50000, 100000, 200000],
        // Ilova izohi uchun (#3a); menejer chegarasi public'ga chiqmaydi.
        walletTopupHoldDays: 7,
        // Shaharlararo (034/036): standart o'chiq — ilova kafelni yashiradi;
        // qolganlari ilovada band/e'lon oynalari uchun.
        intercityEnabled: false,
        intercityFreeCancelMinutes: 60,
        intercityMaxSeatsPerBooking: 4,
        intercityMinLeadMinutes: 30,
        intercityMaxAheadDays: 7,
        intercityMaxDetourMinutes: 15,
      });
    });
  });

  describe('shaharlararo', () => {
    it("standart o'chiq (ustun hali yo'q eski qatorda ham)", async () => {
      const { service } = build();
      await expect(service.getIntercitySettings()).resolves.toEqual({
        intercityEnabled: false,
        intercityFreeCancelMinutes: 60,
        intercityMaxSeatsPerBooking: 4,
        intercityMinLeadMinutes: 30,
        intercityMaxAheadDays: 7,
        intercityMaxDetourMinutes: 15,
      });
      await expect(service.isIntercityEnabled()).resolves.toBe(false);
    });

    it('admin yoqadi — public sozlamada ham ko‘rinadi', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:00:00Z'));
      const { service, repo } = build();
      await expect(service.updateIntercitySettings({ intercityEnabled: true })).resolves.toMatchObject({
        intercityEnabled: true,
      });
      expect(repo.update).toHaveBeenCalledWith('s1', { intercityEnabled: true });
      await expect(service.isIntercityEnabled()).resolves.toBe(true);
      await expect(service.getPublicSettings()).resolves.toMatchObject({ intercityEnabled: true });
    });

    it("bo'sh PATCH hech narsani yozmaydi", async () => {
      const { service, repo } = build({ intercityEnabled: true });
      await expect(service.updateIntercitySettings({})).resolves.toMatchObject({ intercityEnabled: true });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('036: bekor qilish oynasi, o\'rindiq va e\'lon oralig\'i yoziladi', async () => {
      const { service, repo } = build();
      await expect(
        service.updateIntercitySettings({
          intercityFreeCancelMinutes: 120,
          intercityMaxSeatsPerBooking: 3,
          intercityMinLeadMinutes: 60,
          intercityMaxAheadDays: 3,
        }),
      ).resolves.toEqual({
        intercityEnabled: false,
        intercityFreeCancelMinutes: 120,
        intercityMaxSeatsPerBooking: 3,
        intercityMinLeadMinutes: 60,
        intercityMaxAheadDays: 3,
        intercityMaxDetourMinutes: 15,
      });
      expect(repo.update).toHaveBeenCalledWith('s1', {
        intercityFreeCancelMinutes: 120,
        intercityMaxSeatsPerBooking: 3,
        intercityMinLeadMinutes: 60,
        intercityMaxAheadDays: 3,
      });
    });

    it("039: aylanma chegarasi yoziladi (0 — o'chiq)", async () => {
      const { service, repo } = build();
      await expect(service.updateIntercitySettings({ intercityMaxDetourMinutes: 0 })).resolves.toMatchObject({
        intercityMaxDetourMinutes: 0,
      });
      expect(repo.update).toHaveBeenCalledWith('s1', { intercityMaxDetourMinutes: 0 });
    });

    it('saqlangan qiymatlar o\'qiladi', async () => {
      const { service } = build({ intercityEnabled: true, intercityMaxAheadDays: 14, intercityMinLeadMinutes: 0 });
      await expect(service.getIntercitySettings()).resolves.toMatchObject({
        intercityEnabled: true,
        intercityMaxAheadDays: 14,
        intercityMinLeadMinutes: 0,
      });
    });
  });
});
