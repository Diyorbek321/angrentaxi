import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachAuthInterceptor, refreshSession, resetRefreshState } from './session';

afterEach(() => {
  resetRefreshState();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function abortError(): Error {
  const error = new Error('The lock request was aborted');
  error.name = 'AbortError';
  return error;
}

type LockCallback = () => Promise<boolean>;

/**
 * Stand-in for `navigator.locks` that actually queues.
 *
 * A real second tab cannot be spawned in a unit test, but every tab on an origin
 * talks to the *same* lock manager — so one shared fake plus two independent
 * callers reproduces the contention faithfully.
 */
function createFakeLockManager() {
  const waiting: Array<() => void> = [];
  const names: string[] = [];
  let held = false;

  return {
    names,
    manager: {
      async request(
        name: string,
        options: { signal?: AbortSignal },
        callback: LockCallback
      ): Promise<boolean> {
        names.push(name);

        if (held) {
          await new Promise<void>((resolve, reject) => {
            const onAbort = () => reject(abortError());
            options.signal?.addEventListener('abort', onAbort, { once: true });
            waiting.push(() => {
              options.signal?.removeEventListener('abort', onAbort);
              resolve();
            });
          });
        }

        held = true;
        try {
          return await callback();
        } finally {
          held = false;
          waiting.shift()?.();
        }
      },
    },
  };
}

/** A lock manager that accepts requests and never grants them. */
function createWedgedLockManager() {
  return {
    request(name: string, options: { signal?: AbortSignal }): Promise<boolean> {
      return new Promise<boolean>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
      });
    },
  };
}

function stubLocks(locks: unknown): void {
  vi.stubGlobal('navigator', { locks });
}

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

describe('refreshSession cross-tab locking', () => {
  it('takes an origin-scoped Web Lock when the browser has one', async () => {
    const { manager, names } = createFakeLockManager();
    stubLocks(manager);

    const fetcher = vi.fn(async () => true);

    await expect(refreshSession(fetcher)).resolves.toBe(true);

    expect(names).toEqual(['angren-session-refresh']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('stops a second tab refreshing while the first one holds the lock', async () => {
    // The scenario the lock exists for: two dispatcher tabs 401 at the same
    // instant. Overlapping rotations would replay a consumed refresh token and
    // the backend would revoke every session the user has.
    const { manager } = createFakeLockManager();
    stubLocks(manager);

    let releaseFirst!: (value: boolean) => void;
    const firstCall = new Promise<boolean>((resolve) => {
      releaseFirst = resolve;
    });

    const order: string[] = [];
    const firstTab = vi.fn(() => {
      order.push('tab-1:start');
      return firstCall;
    });
    const secondTab = vi.fn(async () => {
      order.push('tab-2:start');
      return true;
    });

    const first = refreshSession(firstTab);
    // Each tab has its own module instance, so the in-tab lock does not apply
    // between them — clearing it is what makes this a second *tab* rather than a
    // second caller in the same one.
    resetRefreshState();
    const second = refreshSession(secondTab);

    // Let both reach the lock manager before anything is allowed to finish.
    await Promise.resolve();
    await Promise.resolve();

    expect(secondTab).not.toHaveBeenCalled();

    releaseFirst(true);
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(order).toEqual(['tab-1:start', 'tab-2:start']);
  });

  it('falls back to the in-tab lock when Web Locks are unavailable', async () => {
    // Older Safari/Firefox, or any non-secure context.
    stubLocks(undefined);

    const fetcher = vi.fn(async () => true);
    const calls = [refreshSession(fetcher), refreshSession(fetcher)];

    expect(await Promise.all(calls)).toEqual([true, true]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('ignores a lock manager that is not shaped like one', async () => {
    stubLocks({ request: 'not a function' });

    const fetcher = vi.fn(async () => true);

    await expect(refreshSession(fetcher)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refreshes unlocked rather than waiting forever behind a wedged holder', async () => {
    vi.useFakeTimers();
    stubLocks(createWedgedLockManager());

    const fetcher = vi.fn(async () => true);
    const pending = refreshSession(fetcher);

    await vi.advanceTimersByTimeAsync(14_000);
    expect(fetcher).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_000);

    await expect(pending).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('releases the lock and reports failure when the refresh itself hangs', async () => {
    // Bounding the *hold* is what keeps a stalled tab from parking the lock for
    // its whole lifetime — the waiter timeout above should never be the thing
    // that fires in practice.
    vi.useFakeTimers();
    const { manager } = createFakeLockManager();
    stubLocks(manager);

    const fetcher = vi.fn(() => new Promise<boolean>(() => {}));
    const pending = refreshSession(fetcher);

    await vi.advanceTimersByTimeAsync(11_000);

    await expect(pending).resolves.toBe(false);
  });

  it('lets the lock go again after a hung refresh so the next attempt runs', async () => {
    vi.useFakeTimers();
    const { manager } = createFakeLockManager();
    stubLocks(manager);

    const hung = refreshSession(() => new Promise<boolean>(() => {}));
    await vi.advanceTimersByTimeAsync(11_000);
    await expect(hung).resolves.toBe(false);

    const fetcher = vi.fn(async () => true);
    const next = refreshSession(fetcher);
    await vi.advanceTimersByTimeAsync(0);

    await expect(next).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
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
