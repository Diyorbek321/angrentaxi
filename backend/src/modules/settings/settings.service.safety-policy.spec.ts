import { SettingsService } from './settings.service';
import { DEFAULT_SAFETY_POLICY_SETTINGS, toSafetyPolicySettings } from './safety-policy-settings';

/** Xavfsizlik / taksi jarimalari / saqlash sozlamalari (docs/INCIDENT-POLICY.md §4–§6). */
describe('SettingsService — xavfsizlik siyosati sozlamalari', () => {
  function build(overrides: Record<string, unknown> = {}) {
    const row: Record<string, unknown> = { id: 's1', platformName: 'Angren Taxi', deliveryFee: 7000, ...overrides };
    const repo = {
      find: jest.fn(async () => [row]),
      update: jest.fn(async (_id: string, changes: Record<string, unknown>) => {
        Object.assign(row, changes);
        return { affected: 1 };
      }),
    };
    return { service: new SettingsService(repo as never), repo };
  }

  it('standart qiymatlar — siyosat hujjatidagidek', async () => {
    await expect(build().service.getSafetyPolicySettings()).resolves.toEqual(DEFAULT_SAFETY_POLICY_SETTINGS);
    expect(DEFAULT_SAFETY_POLICY_SETTINGS).toMatchObject({
      tripShareGraceMinutes: 30,
      freeCancelMinutes: 2,
      lateCancelFee: 3000,
      noShowWaitMinutes: 5,
      noShowFee: 5000,
      driverCancelSignalCount: 3,
    });
  });

  it("noto'g'ri qiymat — standart", () => {
    expect(toSafetyPolicySettings({ tripShareGraceMinutes: 'abc' }).tripShareGraceMinutes).toBe(30);
  });

  it('GET/PATCH global', async () => {
    const { service, repo } = build({ tripShareGraceMinutes: 45 });
    await expect(service.getGlobalSettings()).resolves.toMatchObject({ tripShareGraceMinutes: 45 });
    await service.updateGlobalSettings({ tripShareGraceMinutes: 10 });
    expect(repo.update).toHaveBeenCalledWith('s1', { tripShareGraceMinutes: 10 });
  });
});
