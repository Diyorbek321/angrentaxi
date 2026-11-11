import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { PaymeSubscribeClient, PAYME_SUBSCRIBE_DEFAULT_URL } from './payme-subscribe.client';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, __esModule: true, default: { ...actual.default, post: jest.fn(), isAxiosError: actual.isAxiosError } };
});

const post = axios.post as jest.Mock;

function makeClient(config: Record<string, string>): PaymeSubscribeClient {
  const service = {
    get: jest.fn((key: string, def?: string) => (key in config ? config[key] : def)),
  } as unknown as ConfigService;
  return new PaymeSubscribeClient(service);
}

const configured = { PAYME_MERCHANT_ID: 'mid', PAYME_SUBSCRIBE_KEY: 'skey' };

describe('PaymeSubscribeClient', () => {
  beforeEach(() => post.mockReset());

  it('does nothing without keys (fails closed, no network)', async () => {
    const client = makeClient({ PAYME_MERCHANT_ID: 'mid' });
    expect(client.isConfigured()).toBe(false);
    await expect(client.checkCard('t')).resolves.toEqual({ ok: false, ambiguous: false, reason: 'not_configured' });
    expect(post).not.toHaveBeenCalled();
  });

  it('cards.check uses the public merchant id only', async () => {
    post.mockResolvedValue({
      data: { result: { card: { number: '860006******6311', expire: '03/99', verify: true, recurrent: true } } },
    });
    const client = makeClient(configured);
    const res = await client.checkCard('tok');
    expect(res).toEqual({
      ok: true,
      value: { maskedPan: '860006******6311', expiry: '03/99', verified: true, recurrent: true },
    });
    const [url, body, opts] = post.mock.calls[0];
    expect(url).toBe(PAYME_SUBSCRIBE_DEFAULT_URL);
    expect(body).toMatchObject({ method: 'cards.check', params: { token: 'tok' } });
    expect(opts.headers['X-Auth']).toBe('mid');
  });

  it('receipts.* use merchant id + subscribe key and send tiyin', async () => {
    post.mockResolvedValue({ data: { result: { receipt: { _id: 'r1', state: 0 } } } });
    const client = makeClient(configured);
    await expect(client.createReceipt(25000, 'order-1')).resolves.toEqual({ ok: true, value: 'r1' });
    const [, body, opts] = post.mock.calls[0];
    expect(body).toMatchObject({
      method: 'receipts.create',
      params: { amount: 2500000, account: { order_id: 'order-1' } },
    });
    expect(opts.headers['X-Auth']).toBe('mid:skey');
  });

  it('rejects fractional-tiyin and non-positive amounts before calling Payme', async () => {
    const client = makeClient(configured);
    await expect(client.createReceipt(0, 'o')).resolves.toMatchObject({ ok: false, reason: 'invalid_amount' });
    await expect(client.createReceipt(10.001, 'o')).resolves.toMatchObject({ ok: false, reason: 'invalid_amount' });
    expect(post).not.toHaveBeenCalled();
  });

  it('returns the receipt state after paying', async () => {
    post.mockResolvedValue({ data: { result: { receipt: { _id: 'r1', state: 4 } } } });
    const client = makeClient(configured);
    await expect(client.payReceipt('r1', 'tok')).resolves.toEqual({ ok: true, value: 4 });
  });

  it('a JSON-RPC error is a definite (non-ambiguous) failure', async () => {
    post.mockResolvedValue({ data: { error: { code: -31630, message: 'insufficient' } } });
    const client = makeClient(configured);
    await expect(client.payReceipt('r1', 'tok')).resolves.toEqual({
      ok: false,
      ambiguous: false,
      reason: 'payme_-31630',
      rpcCode: -31630,
    });
  });

  it('a timeout is ambiguous — money may or may not have moved', async () => {
    const err = Object.assign(new Error('timeout'), { isAxiosError: true, code: 'ECONNABORTED' });
    post.mockRejectedValue(err);
    const client = makeClient(configured);
    await expect(client.payReceipt('r1', 'tok')).resolves.toMatchObject({ ok: false, ambiguous: true });
  });

  it('honours a sandbox URL override', async () => {
    post.mockResolvedValue({ data: { result: { state: 4 } } });
    const client = makeClient({ ...configured, PAYME_SUBSCRIBE_API_URL: 'https://checkout.test.paycom.uz/api' });
    await expect(client.getReceiptState('r1')).resolves.toEqual({ ok: true, value: 4 });
    expect(post.mock.calls[0][0]).toBe('https://checkout.test.paycom.uz/api');
  });
});
