import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachAuthInterceptor, refreshSession, resetRefreshState } from './session';

afterEach(() => {
  resetRefreshState();
});

/**
 * Builds an axios instance whose transport is scripted rather than real.
 *
 * `statuses` is consumed one entry per request, so a case can say "first two
 * calls 401, everything after that 200" and assert on what the interceptor did
 * in between.
 */
function createScriptedClient(statuses: number[]) {
  const requests: InternalAxiosRequestConfig[] = [];
  const queue = [...statuses];

  const client = axios.create({ baseURL: '/api/proxy' });

  client.defaults.adapter = async (config) => {
    requests.push(config as InternalAxiosRequestConfig);
    const status = queue.shift() ?? 200;

    const response: AxiosResponse = {
      data: { success: status < 400 },
      status,
      statusText: String(status),
      headers: {},
      config: config as InternalAxiosRequestConfig,
    };

    if (status >= 400) {
      throw new AxiosError(
        `Request failed with status ${status}`,
        String(status),
        config as InternalAxiosRequestConfig,
        {},
        response
      );
    }

    return response;
  };

  return { client, requests };
}

describe('refreshSession', () => {
  it('collapses concurrent callers onto a single refresh', async () => {
    // The refresh is held open so all three callers are genuinely in flight at
    // the same time — resolving it immediately would let them queue up serially
    // and the test would pass even without a lock.
    let resolveRefresh!: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetcher = vi.fn(() => pending);

    const calls = [refreshSession(fetcher), refreshSession(fetcher), refreshSession(fetcher)];
    resolveRefresh(true);

    expect(await Promise.all(calls)).toEqual([true, true, true]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('releases the lock so a later refresh can run again', async () => {
    const fetcher = vi.fn(async () => true);

    await refreshSession(fetcher);
    await refreshSession(fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('reports failure instead of throwing when the refresh call blows up', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network down');
    });

    await expect(refreshSession(fetcher)).resolves.toBe(false);
  });
});

describe('attachAuthInterceptor', () => {
  it('refreshes once for a burst of simultaneous 401s and retries them all', async () => {
    // This is the case that makes the lock mandatory: the backend rotates refresh
    // tokens and treats a replayed one as theft, revoking every session the user
    // has. Four rotations from one page load would log the dispatcher out
    // everywhere.
    const { client, requests } = createScriptedClient([401, 401, 401, 401]);
    const fetcher = vi.fn(async () => true);
    attachAuthInterceptor(client, { fetcher, onSessionLost: () => {} });

    const results = await Promise.all([
      client.get('/orders/active'),
      client.get('/drivers/online'),
      client.get('/support/threads'),
      client.get('/users/me'),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.status === 200)).toBe(true);
    // Four original attempts plus four retries.
    expect(requests).toHaveLength(8);
  });

  it('gives up instead of looping when the retry is also rejected', async () => {
    const { client, requests } = createScriptedClient([401, 401]);
    const fetcher = vi.fn(async () => true);
    attachAuthInterceptor(client, { fetcher, onSessionLost: () => {} });

    await expect(client.get('/orders/active')).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(2);
  });

  it('signals a lost session when the refresh is refused', async () => {
    const { client } = createScriptedClient([401]);
    const fetcher = vi.fn(async () => false);
    const onSessionLost = vi.fn();
    attachAuthInterceptor(client, { fetcher, onSessionLost });

    await expect(client.get('/orders/active')).rejects.toBeInstanceOf(AxiosError);

    expect(onSessionLost).toHaveBeenCalledTimes(1);
  });

  it('never refreshes on behalf of the OTP endpoints', async () => {
    // A 401 from verify-otp means "wrong code", not "expired session"; trying to
    // refresh there would burn a good refresh token for nothing.
    const { client } = createScriptedClient([401]);
    const fetcher = vi.fn(async () => true);
    const onSessionLost = vi.fn();
    attachAuthInterceptor(client, { fetcher, onSessionLost });

    await expect(client.post('/auth/verify-otp', {})).rejects.toBeInstanceOf(AxiosError);

    expect(fetcher).not.toHaveBeenCalled();
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it('passes non-401 failures straight through', async () => {
    const { client } = createScriptedClient([500]);
    const fetcher = vi.fn(async () => true);
    attachAuthInterceptor(client, { fetcher, onSessionLost: () => {} });

    await expect(client.get('/orders/active')).rejects.toMatchObject({
      response: { status: 500 },
    });

    expect(fetcher).not.toHaveBeenCalled();
  });
});
