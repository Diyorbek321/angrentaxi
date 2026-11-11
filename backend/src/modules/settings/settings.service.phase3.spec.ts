import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';

/** Bosqich 3: hamyonni to'ldirish sozlamalari va platforma STIR'i (§11, §15). */
describe("SettingsService — hamyonni to'ldirish va platforma STIR'i", () => {
  function build(overrides: Record<string, unknown> = {}) {
    const row: Record<string, unknown> = {
      id: 's1',
      walletTopupEnabled: false,
      walletTopupMin: 10000,
      walletTopupMax: 2000000,
      walletTopupPresets: [50000, 100000, 200000],
      platformTin: null,
      ...overrides,
    };
    const repo = {
      find: jest.fn(async () => [row]),
      update: jest.fn(async (_id: string, changes: Record<string, unknown>) => {
        Object.assign(row, changes);
        return { affected: 1 };
      }),
    };
    return { service: new SettingsService(repo as never), repo, row };
  }

  it("standart: o'chiq, 10 000 – 2 000 000, tezkor tugmalar 50/100/200 ming", async () => {
    await expect(build().service.getWalletTopupSettings()).resolves.toEqual({
      walletTopupEnabled: false,
      walletTopupMin: 10000,
      walletTopupMax: 2000000,
      walletTopupPresets: [50000, 100000, 200000],
      // Security review: yechish ushlab turilishi (#3a), menejer chegarasi (#6).
      walletTopupHoldDays: 7,
      manualAdjustmentManagerLimit: 2000000,
    });
  });

  it("yoqish va chegaralarni o'zgartirish; tugmalar saralanadi va takrorlar olib tashlanadi", async () => {
    const { service } = build();
    const res = await service.updateWalletTopupSettings({
      walletTopupEnabled: true,
      walletTopupMin: 20000,
      walletTopupPresets: [200000, 50000, 50000],
    });
    expect(res).toEqual({
      walletTopupEnabled: true,
      walletTopupMin: 20000,
      walletTopupMax: 2000000,
      walletTopupPresets: [50000, 200000],
      walletTopupHoldDays: 7,
      manualAdjustmentManagerLimit: 2000000,
    });
  });

  it('hold kunlari va menejer chegarasi o\'zgartiriladi', async () => {
    const res = await build().service.updateWalletTopupSettings({
      walletTopupHoldDays: 3,
      manualAdjustmentManagerLimit: 500000,
    });
    expect(res).toMatchObject({ walletTopupHoldDays: 3, manualAdjustmentManagerLimit: 500000 });
  });

  it('min > max — 400', async () => {
    await expect(
      build().service.updateWalletTopupSettings({ walletTopupMin: 3000000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('chegaradan tashqaridagi tezkor tugma — 400', async () => {
    await expect(
      build().service.updateWalletTopupSettings({ walletTopupPresets: [5000] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("platforma STIR'i legal-compliance orqali o'rnatiladi va o'chiriladi", async () => {
    const { service } = build();
    expect((await service.updateLegalComplianceSettings({ platformTin: '301234567' })).platformTin).toBe(
      '301234567',
    );
    await expect(service.getPlatformTin()).resolves.toBe('301234567');
    expect((await service.updateLegalComplianceSettings({ platformTin: null })).platformTin).toBeNull();
  });

  it("noto'g'ri STIR — 400", async () => {
    await expect(
      build().service.updateLegalComplianceSettings({ platformTin: '12345' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
