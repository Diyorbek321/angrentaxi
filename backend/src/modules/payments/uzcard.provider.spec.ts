import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { UzcardProvider } from './uzcard.provider';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('UzcardProvider', () => {
  const TERMINAL_ID = 'terminal-123';
  const SECRET_KEY = 'super-secret-key';

  function makeProvider(config: Record<string, string>): UzcardProvider {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        return key in config ? config[key] : defaultValue ?? '';
      }),
    } as unknown as ConfigService;

    return new UzcardProvider(configService);
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verify()', () => {
    it('fails closed (returns false) when UZCARD_TERMINAL_ID is not configured', async () => {
      const provider = makeProvider({});

      const result = await provider.verify('tx_1');

      expect(result).toBe(false);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('returns true when configured and the provider reports PAID', async () => {
      const provider = makeProvider({ UZCARD_TERMINAL_ID: TERMINAL_ID });
      mockedAxios.get.mockResolvedValueOnce({ data: { status: 'PAID' } });

      const result = await provider.verify('tx_2');

      expect(result).toBe(true);
    });

    it('returns false when configured but the provider does not report PAID', async () => {
      const provider = makeProvider({ UZCARD_TERMINAL_ID: TERMINAL_ID });
      mockedAxios.get.mockResolvedValueOnce({ data: { status: 'PENDING' } });

      const result = await provider.verify('tx_3');

      expect(result).toBe(false);
    });

    it('fetchStatus: provider status, null on network error (fail closed)', async () => {
      const provider = makeProvider({ UZCARD_TERMINAL_ID: TERMINAL_ID });
      mockedAxios.get.mockResolvedValueOnce({ data: { status: 'CANCELLED' } });
      await expect(provider.fetchStatus('tx_4')).resolves.toBe('CANCELLED');
      mockedAxios.get.mockRejectedValueOnce(new Error('timeout'));
      await expect(provider.fetchStatus('tx_5')).resolves.toBeNull();
    });
  });

  describe('verifyCallback()', () => {
    function sign(
      terminalId: string,
      orderId: string,
      amount: number,
      secretKey: string,
    ): string {
      const data = `${terminalId}&${orderId}&${amount}`;
      return createHmac('sha256', secretKey).update(data).digest('hex');
    }

    it('fails closed (returns false) when UZCARD_SECRET_KEY is not configured', () => {
      const provider = makeProvider({});

      const validSign = sign(TERMINAL_ID, 'order_1', 1000, SECRET_KEY);

      const result = provider.verifyCallback({
        terminal_id: TERMINAL_ID,
        order_id: 'order_1',
        amount: 1000,
        sign: validSign,
      });

      expect(result).toBe(false);
    });

    it('returns true when configured with a valid signature', () => {
      const provider = makeProvider({ UZCARD_SECRET_KEY: SECRET_KEY, UZCARD_TERMINAL_ID: TERMINAL_ID });
      const validSign = sign(TERMINAL_ID, 'order_2', 2000, SECRET_KEY);

      const result = provider.verifyCallback({
        terminal_id: TERMINAL_ID,
        order_id: 'order_2',
        amount: 2000,
        sign: validSign,
      });

      expect(result).toBe(true);
    });

    it('returns false when configured but the signature is wrong', () => {
      const provider = makeProvider({ UZCARD_SECRET_KEY: SECRET_KEY });

      const result = provider.verifyCallback({
        terminal_id: TERMINAL_ID,
        order_id: 'order_3',
        amount: 3000,
        sign: 'deadbeef',
      });

      expect(result).toBe(false);
    });

    // Security review #7: imzo kaliti boshqa terminal bilan umumiy bo'lsa ham
    // callback faqat BIZNING terminalimizdan qabul qilinadi.
    it('returns false for a validly signed callback from another terminal', () => {
      const provider = makeProvider({ UZCARD_SECRET_KEY: SECRET_KEY, UZCARD_TERMINAL_ID: TERMINAL_ID });
      const foreignSign = sign('other-terminal', 'order_5', 5000, SECRET_KEY);

      expect(
        provider.verifyCallback({ terminal_id: 'other-terminal', order_id: 'order_5', amount: 5000, sign: foreignSign }),
      ).toBe(false);
    });

    it('returns false when UZCARD_TERMINAL_ID is not configured (fail closed)', () => {
      const provider = makeProvider({ UZCARD_SECRET_KEY: SECRET_KEY });
      const validSign = sign(TERMINAL_ID, 'order_6', 6000, SECRET_KEY);

      expect(
        provider.verifyCallback({ terminal_id: TERMINAL_ID, order_id: 'order_6', amount: 6000, sign: validSign }),
      ).toBe(false);
    });

    it('returns false when configured but no signature is present', () => {
      const provider = makeProvider({ UZCARD_SECRET_KEY: SECRET_KEY });

      const result = provider.verifyCallback({
        terminal_id: TERMINAL_ID,
        order_id: 'order_4',
        amount: 4000,
      });

      expect(result).toBe(false);
    });
  });
});
