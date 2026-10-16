import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';

/** Bepul yetkazish chegarasi va yetkazish vaqti (docs/specs/food-market-ux-v5.md §7). */
describe('SettingsService — bepul yetkazish va yetkazish vaqti', () => {
  function build(overrides: Record<string, unknown> = {}) {
    const row: Record<string, unknown> = {
      id: 's1',
      platformName: 'Angren Taxi',
      supportPhone: '+998',
      supportEmail: 'a@b.uz',
      maintenanceMode: false,
      deliveryFee: 7000,
      maxCashVendorOrder: 200000,
      freeDeliveryFrom: 0,
      deliveryEtaMinMinutes: 30,
      deliveryEtaMaxMinutes: 50,
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

  it('getDeliveryPricing — haq va chegara', async () => {
    const { service } = build({ freeDeliveryFrom: 100000 });
    await expect(service.getDeliveryPricing()).resolves.toEqual({ deliveryFee: 7000, freeDeliveryFrom: 100000 });
  });

  it("eski qator (ustun hali o'qilmagan) — chegara 0, vaqt 30–50", async () => {
    const { service } = build({
      freeDeliveryFrom: undefined,
      deliveryEtaMinMinutes: undefined,
      deliveryEtaMaxMinutes: undefined,
    });
    await expect(service.getDeliveryPricing()).resolves.toEqual({ deliveryFee: 7000, freeDeliveryFrom: 0 });
    await expect(service.getPublicSettings()).resolves.toMatchObject({
      freeDeliveryFrom: 0,
      deliveryEtaMinMinutes: 30,
      deliveryEtaMaxMinutes: 50,
    });
  });

  it("GET /settings/public — uch yangi maydon", async () => {
    const { service } = build({ freeDeliveryFrom: 100000, deliveryEtaMinMinutes: 25, deliveryEtaMaxMinutes: 45 });
    await expect(service.getPublicSettings()).resolves.toMatchObject({
      deliveryFee: 7000,
      freeDeliveryFrom: 100000,
      deliveryEtaMinMinutes: 25,
      deliveryEtaMaxMinutes: 45,
    });
  });

  it('GET global — uch yangi maydon', async () => {
    const { service } = build();
    await expect(service.getGlobalSettings()).resolves.toEqual({
      platformName: 'Angren Taxi',
      supportPhone: '+998',
      supportEmail: 'a@b.uz',
      maintenanceMode: false,
      deliveryFee: 7000,
      maxCashVendorOrder: 200000,
      freeDeliveryFrom: 0,
      deliveryEtaMinMinutes: 30,
      deliveryEtaMaxMinutes: 50,
    });
  });

  it('PATCH global — yangi maydonlar saqlanadi', async () => {
    const { service, repo } = build();
    const res = await service.updateGlobalSettings({
      freeDeliveryFrom: 100000,
      deliveryEtaMinMinutes: 20,
      deliveryEtaMaxMinutes: 40,
    });
    expect(repo.update).toHaveBeenCalledWith('s1', {
      freeDeliveryFrom: 100000,
      deliveryEtaMinMinutes: 20,
      deliveryEtaMaxMinutes: 40,
    });
    expect(res).toMatchObject({ freeDeliveryFrom: 100000, deliveryEtaMinMinutes: 20, deliveryEtaMaxMinutes: 40 });
  });

  it('PATCH global — faqat ruxsat etilgan maydonlar bazaga boradi', async () => {
    const { service, repo } = build();
    await service.updateGlobalSettings({
      deliveryFee: 8000,
      id: 'hijack',
      defaultCommissionRate: 0,
      platformTin: '123456789',
    } as never);
    expect(repo.update).toHaveBeenCalledWith('s1', { deliveryFee: 8000 });
  });

  it("PATCH global — joriy qiymat bilan birlashtirilgach min > max bo'lsa 400, hech narsa yozilmaydi", async () => {
    const { service, repo } = build();
    await expect(service.updateGlobalSettings({ deliveryEtaMinMinutes: 60 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateGlobalSettings({ deliveryEtaMaxMinutes: 20 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("PATCH global — ikkalasi birga o'zgarsa yangi qiymatlar tekshiriladi", async () => {
    const { service } = build();
    await expect(
      service.updateGlobalSettings({ deliveryEtaMinMinutes: 60, deliveryEtaMaxMinutes: 90 }),
    ).resolves.toMatchObject({ deliveryEtaMinMinutes: 60, deliveryEtaMaxMinutes: 90 });
  });
});
