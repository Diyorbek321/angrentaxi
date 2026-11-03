import { cardPaymentsConfigured, clickConfigured, paymeConfigured, uzcardConfigured } from './card-availability';

const config = (values: Record<string, string>) => ({
  get: <T>(key: string, fallback?: T) => (values[key] ?? fallback) as T,
});

describe('card-availability — karta to\'lovi mavjudmi', () => {
  it('hech bir provayder sozlanmagan — mavjud emas', () => {
    expect(cardPaymentsConfigured(config({}))).toBe(false);
  });

  it('yarim sozlangan provayder hisobga olinmaydi', () => {
    expect(paymeConfigured(config({ PAYME_MERCHANT_ID: 'm' }))).toBe(false);
    expect(clickConfigured(config({ CLICK_MERCHANT_ID: 'm', CLICK_SECRET_KEY: 's' }))).toBe(false);
    expect(uzcardConfigured(config({ UZCARD_TERMINAL_ID: 't' }))).toBe(false);
    expect(cardPaymentsConfigured(config({ PAYME_MERCHANT_ID: 'm', UZCARD_TERMINAL_ID: 't' }))).toBe(false);
  });

  it('bitta to\'liq provayder yetarli', () => {
    expect(cardPaymentsConfigured(config({ PAYME_MERCHANT_ID: 'm', PAYME_SECRET_KEY: 's' }))).toBe(true);
    expect(
      cardPaymentsConfigured(config({ CLICK_MERCHANT_ID: 'm', CLICK_SECRET_KEY: 's', CLICK_SERVICE_ID: '1' })),
    ).toBe(true);
    expect(cardPaymentsConfigured(config({ UZCARD_TERMINAL_ID: 't', UZCARD_SECRET_KEY: 's' }))).toBe(true);
  });
});
