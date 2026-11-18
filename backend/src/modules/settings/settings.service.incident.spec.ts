import { SettingsService } from './settings.service';
import { DEFAULT_INCIDENT_SETTINGS, strikeLadderError, toIncidentSettings } from './incident-settings';

/** Shikoyat va hodisa sozlamalari (docs/INCIDENT-POLICY.md §3). */
describe('SettingsService — shikoyat/hodisa sozlamalari', () => {
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

  it("standart qiymatlar — siyosat hujjatidagidek", async () => {
    await expect(build().service.getIncidentSettings()).resolves.toEqual(DEFAULT_INCIDENT_SETTINGS);
    expect(DEFAULT_INCIDENT_SETTINGS).toMatchObject({
      incidentReportWindowDays: 7,
      suspensionDays: 3,
      strikeWindowDays: 90,
      strikeWarningAt: 1,
      strikeSuspensionAt: 3,
      strikeBlockAt: 5,
      ratingSignalWindow: 20,
      ratingSignalThreshold: 4.3,
    });
  });

  it('decimal satr o\'qiladi', () => {
    expect(toIncidentSettings({ ratingSignalThreshold: '4.10' }).ratingSignalThreshold).toBe(4.1);
  });

  it('GET/PATCH global', async () => {
    const { service, repo } = build({ suspensionDays: 5 });
    await expect(service.getGlobalSettings()).resolves.toMatchObject({ suspensionDays: 5, strikeBlockAt: 5 });
    await expect(service.updateGlobalSettings({ strikeWindowDays: 60 })).resolves.toMatchObject({
      strikeWindowDays: 60,
    });
    expect(repo.update).toHaveBeenCalledWith('s1', { strikeWindowDays: 60 });
  });

  it("zinapoya tartibi buzilsa — 400, hech narsa yozilmaydi", async () => {
    const { service, repo } = build();
    await expect(service.updateGlobalSettings({ strikeSuspensionAt: 7 })).rejects.toThrow(/zinapoyasi/);
    expect(repo.update).not.toHaveBeenCalled();
    expect(strikeLadderError({ strikeWarningAt: 1, strikeSuspensionAt: 3, strikeBlockAt: 5 })).toBeNull();
  });
});
