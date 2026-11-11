import { SettingsService } from './settings.service';
import { DEFAULT_DELIVERY_INCIDENT_SETTINGS } from './delivery-incident-settings';

/** Yetkazish hodisalari sozlamalari (docs/INCIDENT-POLICY.md §2). */
describe("SettingsService — yetkazish hodisalari", () => {
  function build(overrides: Record<string, unknown> = {}) {
    const row: Record<string, unknown> = {
      id: 's1',
      platformName: 'Angren Taxi',
      deliveryFee: 7000,
      maxCashVendorOrder: 200000,
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

  it('ustun yo\'q eski qator — standart qiymatlar', async () => {
    await expect(build().service.getDeliveryIncidentSettings()).resolves.toEqual(
      DEFAULT_DELIVERY_INCIDENT_SETTINGS,
    );
    expect(DEFAULT_DELIVERY_INCIDENT_SETTINGS).toMatchObject({
      parcelMaxDeclaredValue: 1_000_000,
      dropoffFreeWaitMinutes: 5,
      returnFeePercent: 50,
      refusalCashBlockCount: 2,
      refusalWindowDays: 30,
      stuckDeliveryMinutes: 60,
      staleCourierLocationMinutes: 10,
    });
  });

  it('GET/PATCH global — hodisa sozlamalari', async () => {
    const { service, repo } = build({ returnFeePercent: 40 });
    await expect(service.getGlobalSettings()).resolves.toMatchObject({ returnFeePercent: 40, stuckDeliveryMinutes: 60 });
    await expect(service.updateGlobalSettings({ dropoffFreeWaitMinutes: 7 })).resolves.toMatchObject({
      dropoffFreeWaitMinutes: 7,
    });
    expect(repo.update).toHaveBeenCalledWith('s1', { dropoffFreeWaitMinutes: 7 });
  });

  it('public — ilovaga kerakli uchtasi', async () => {
    await expect(build({ parcelMaxDeclaredValue: 500000 }).service.getPublicSettings()).resolves.toMatchObject({
      parcelMaxDeclaredValue: 500000,
      dropoffFreeWaitMinutes: 5,
      returnFeePercent: 50,
    });
  });
});
