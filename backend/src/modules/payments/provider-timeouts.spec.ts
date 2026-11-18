import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PaymeProvider } from './payme.provider';
import { PAYMENT_PROVIDER_TIMEOUT_MS } from './provider-http';
import { UzcardProvider } from './uzcard.provider';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Provayder osilib qolsa, so'rov ham cheksiz osilmasin: timeout bo'lmasa
 * haydovchi "to'ldirish" ekranida abadiy kutadi, server ulanishlari esa
 * to'planib qoladi. Timeout'da har bir chaqiruv xato (fail closed) qaytaradi.
 */
describe("to'lov provayderlari — so'rov timeout'i", () => {
  const config = (env: Record<string, string>) =>
    ({ get: (k: string, d?: string) => env[k] ?? d ?? '' }) as unknown as ConfigService;

  afterEach(() => jest.clearAllMocks());

  it('Payme verify', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    await new PaymeProvider(config({ PAYME_MERCHANT_ID: 'm', PAYME_SECRET_KEY: 's' })).verify('tx');
    expect(mockedAxios.post.mock.calls[0][2]).toEqual(expect.objectContaining({ timeout: PAYMENT_PROVIDER_TIMEOUT_MS }));
  });

  it('Uzcard status', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { status: 'PAID' } });
    await new UzcardProvider(config({ UZCARD_TERMINAL_ID: 't' })).fetchStatus('tx');
    expect(mockedAxios.get.mock.calls[0][1]).toEqual(expect.objectContaining({ timeout: PAYMENT_PROVIDER_TIMEOUT_MS }));
  });

  it("Uzcard to'lov yaratish", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { redirect_url: 'https://x', transaction_id: 'tx' } });
    await new UzcardProvider(config({ UZCARD_TERMINAL_ID: 't' })).initiate(1000, 'order-1', '+998901234567');
    expect(mockedAxios.post.mock.calls[0][2]).toEqual(expect.objectContaining({ timeout: PAYMENT_PROVIDER_TIMEOUT_MS }));
  });

  it('timeout 15 s dan oshmaydi (ilova kutishi chegarali)', () => {
    expect(PAYMENT_PROVIDER_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
  });
});
