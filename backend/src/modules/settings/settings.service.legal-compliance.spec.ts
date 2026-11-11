import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';

describe('SettingsService — huquqiy talablar sozlamalari', () => {
  function build(overrides: Record<string, unknown> = {}) {
    const row = {
      id: 's1',
      defaultCommissionRate: 10,
      legalComplianceEnforcedFrom: null,
      minDriverAgeYears: 21,
      minLicenceExperienceYears: 3,
      maxVehicleAgeYears: 15,
      taxWithholdingEnabled: false,
      driverTaxWithholdingRate: 1,
      launchPromoCommissionUntil: null,
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

  it('standart qiymatlar — hech narsa majburlanmaydi', async () => {
    const { service } = build();
    await expect(service.getLegalComplianceSettings()).resolves.toEqual({
      legalComplianceEnforcedFrom: null,
      minDriverAgeYears: 21,
      minLicenceExperienceYears: 3,
      maxVehicleAgeYears: 15,
      taxWithholdingEnabled: false,
      driverTaxWithholdingRate: 1,
      platformTin: null,
    });
  });

  it('majburlash sanasi ISO satr bo‘lib qaytadi va null bilan o‘chiriladi', async () => {
    const { service, repo } = build();

    const on = await service.updateLegalComplianceSettings({
      legalComplianceEnforcedFrom: '2026-12-01T00:00:00.000Z',
      taxWithholdingEnabled: true,
    });
    expect(on.legalComplianceEnforcedFrom).toBe('2026-12-01T00:00:00.000Z');
    expect(on.taxWithholdingEnabled).toBe(true);
    expect(repo.update).toHaveBeenCalledWith('s1', {
      legalComplianceEnforcedFrom: new Date('2026-12-01T00:00:00.000Z'),
      taxWithholdingEnabled: true,
    });

    const off = await service.updateLegalComplianceSettings({ legalComplianceEnforcedFrom: null });
    expect(off.legalComplianceEnforcedFrom).toBeNull();
  });

  it('yuborilmagan maydon o‘zgarmaydi', async () => {
    const { service, repo } = build();
    await service.updateLegalComplianceSettings({ maxVehicleAgeYears: 12 });
    expect(repo.update).toHaveBeenCalledWith('s1', { maxVehicleAgeYears: 12 });
  });

  it('komissiya sozlamasi aksiya sanasi va faolligini ham qaytaradi', async () => {
    const { service } = build({ launchPromoCommissionUntil: new Date('2099-01-01T00:00:00Z') });
    await expect(service.getCommissionSettings()).resolves.toEqual({
      defaultCommissionRate: 10,
      launchPromoCommissionUntil: '2099-01-01T00:00:00.000Z',
      launchPromoActive: true,
    });
  });

  it('aksiya sanasini o‘rnatish va o‘chirish', async () => {
    const { service } = build();
    const set = await service.setLaunchPromoCommissionUntil('2099-01-01T00:00:00.000Z');
    expect(set.launchPromoCommissionUntil).toBe('2099-01-01T00:00:00.000Z');
    const cleared = await service.setLaunchPromoCommissionUntil(null);
    expect(cleared).toEqual({
      defaultCommissionRate: 10,
      launchPromoCommissionUntil: null,
      launchPromoActive: false,
    });
  });

  it('noto‘g‘ri sana — 400', async () => {
    const { service } = build();
    await expect(service.setLaunchPromoCommissionUntil('not-a-date')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.updateLegalComplianceSettings({ legalComplianceEnforcedFrom: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('yakunlash uchun moliyaviy siyosat bitta o‘qishda', async () => {
    const until = new Date('2099-01-01T00:00:00Z');
    const { service } = build({
      launchPromoCommissionUntil: until,
      taxWithholdingEnabled: true,
      driverTaxWithholdingRate: 1.5,
    });
    await expect(service.getCompletionFinancePolicy()).resolves.toEqual({
      defaultCommissionRate: 10,
      launchPromoCommissionUntil: until,
      taxWithholding: { enabled: true, ratePercent: 1.5 },
    });
  });
});
