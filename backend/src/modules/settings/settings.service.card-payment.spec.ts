import { SettingsService } from './settings.service';

/** Kartali buyurtma — to'lovdan oldin sotuvchiga ketmaydi (docs/INCIDENT-POLICY.md §1). */
describe('SettingsService — karta to\'lovi', () => {
  function build(env: Record<string, string> = {}, overrides: Record<string, unknown> = {}) {
    const row: Record<string, unknown> = {
      id: 's1',
      platformName: 'Angren Taxi',
      deliveryFee: 7000,
      maxCashVendorOrder: 200000,
      cardPaymentTimeoutMinutes: 15,
      ...overrides,
    };
    const repo = {
      find: jest.fn(async () => [row]),
      update: jest.fn(async (_id: string, changes: Record<string, unknown>) => {
        Object.assign(row, changes);
        return { affected: 1 };
      }),
    };
    const config = { get: <T>(key: string, fallback?: T) => (env[key] ?? fallback) as T };
    return { service: new SettingsService(repo as never, config as never), repo, row };
  }

  it('provayder sozlanmagan — cardPaymentsAvailable false (public)', async () => {
    const { service } = build();
    expect(service.cardPaymentsAvailable()).toBe(false);
    await expect(service.getPublicSettings()).resolves.toMatchObject({ cardPaymentsAvailable: false });
  });

  it('Payme sozlangan — true', async () => {
    const { service } = build({ PAYME_MERCHANT_ID: 'm', PAYME_SECRET_KEY: 's' });
    expect(service.cardPaymentsAvailable()).toBe(true);
    await expect(service.getPublicSettings()).resolves.toMatchObject({
      cardPaymentsAvailable: true,
      cardPaymentProviders: ['payme'],
    });
  });

  it('ConfigService berilmagan (qo\'lda yig\'ilgan spec) — false', () => {
    const service = new SettingsService({ find: jest.fn() } as never);
    expect(service.cardPaymentsAvailable()).toBe(false);
  });

  it('cardPaymentTimeoutMinutes — standart 15, eski qator ham 15', async () => {
    await expect(build().service.getCardPaymentTimeoutMinutes()).resolves.toBe(15);
    await expect(build({}, { cardPaymentTimeoutMinutes: undefined }).service.getCardPaymentTimeoutMinutes()).resolves.toBe(15);
    await expect(build({}, { cardPaymentTimeoutMinutes: 30 }).service.getCardPaymentTimeoutMinutes()).resolves.toBe(30);
  });

  it('GET/PATCH global — cardPaymentTimeoutMinutes', async () => {
    const { service, repo } = build();
    await expect(service.getGlobalSettings()).resolves.toMatchObject({ cardPaymentTimeoutMinutes: 15 });
    await expect(service.updateGlobalSettings({ cardPaymentTimeoutMinutes: 20 })).resolves.toMatchObject({
      cardPaymentTimeoutMinutes: 20,
    });
    expect(repo.update).toHaveBeenCalledWith('s1', { cardPaymentTimeoutMinutes: 20 });
  });
});
