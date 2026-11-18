import { ConfigService } from '@nestjs/config';
import { PaymeProvider } from './payme.provider';
import { ClickProvider } from './click.provider';

/**
 * To'lovdan keyin foydalanuvchini ilovaga qaytarish (docs §21 → 8-band).
 * Payme GET checkout: base64("m=…;ac.order_id=…;a=…;c=<qaytish>"),
 * Click: `return_url`.
 */
describe('checkout qaytish manzili', () => {
  const config = (values: Record<string, string>) =>
    ({ get: (key: string, fallback?: string) => values[key] ?? fallback }) as unknown as ConfigService;

  describe('Payme', () => {
    const provider = new PaymeProvider(config({ PAYME_MERCHANT_ID: 'merchant-1', PAYME_SECRET_KEY: 'k' }));
    const decode = (url: string) =>
      Buffer.from(url.replace('https://checkout.paycom.uz/', ''), 'base64').toString('utf8');

    it("hujjatdagi `kalit=qiymat;` formati, summa tiyinda, `c` — qaytish manzili", async () => {
      const result = await provider.initiate(50000, 'topup_abc', '+998901234567', {
        returnUrl: 'angrengo://wallet/topup/abc',
      });
      expect(result.url.startsWith('https://checkout.paycom.uz/')).toBe(true);
      expect(decode(result.url)).toBe(
        'm=merchant-1;ac.order_id=topup_abc;a=5000000;l=ru;c=angrengo://wallet/topup/abc',
      );
    });

    it("qaytish manzili berilmasa `c` yo'q (callback API'si brauzer manzili emas)", async () => {
      const result = await provider.initiate(50000, 'order-1', '+998901234567');
      expect(decode(result.url)).toBe('m=merchant-1;ac.order_id=order-1;a=5000000;l=ru');
    });
  });

  describe('Click', () => {
    const provider = new ClickProvider(
      config({ CLICK_SERVICE_ID: 's1', CLICK_MERCHANT_ID: 'm1', CLICK_SECRET_KEY: 'k', APP_URL: 'https://api.example' }),
    );

    it('return_url — berilgan qaytish manzili', async () => {
      const result = await provider.initiate(50000, 'topup_abc', '', { returnUrl: 'angrengo://wallet/topup/abc' });
      expect(new URL(result.url).searchParams.get('return_url')).toBe('angrengo://wallet/topup/abc');
      expect(new URL(result.url).searchParams.get('transaction_param')).toBe('topup_abc');
    });

    it('berilmasa — avvalgi standart', async () => {
      const result = await provider.initiate(50000, 'order-1', '');
      expect(new URL(result.url).searchParams.get('return_url')).toBe('https://api.example/payments/click/return');
    });
  });
});
